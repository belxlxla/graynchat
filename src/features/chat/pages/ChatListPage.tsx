import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { 
  User as UserIcon, Users, 
  Trash2, Check, Search, Plus, Pencil, X,
  CheckCircle2, Circle, Settings, RefreshCw, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

interface ChatRoom {
  id: string; 
  type: 'individual' | 'group';
  title: string;
  avatar: string | null;
  membersCount: number;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isMuted?: boolean;
}

interface Friend {
  id: number;
  friend_user_id: string; 
  name: string;
  avatar: string | null;
}

interface UserProfile {
  id: string;
  name: string;
  avatar: string | null;
}

export default function ChatListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [friendsList, setFriendsList] = useState<Friend[]>([]); 

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChat, setEditingChat] = useState<ChatRoom | null>(null);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [leaveChatTarget, setLeaveChatTarget] = useState<ChatRoom | null>(null);

  const fetchChats = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data: roomsData, error } = await supabase
        .from('room_members')
        .select(`
          *,
          room:chat_rooms (
            id,
            type,
            title,
            avatar,
            last_message,
            last_message_at,
            members_count
          )
        `)
        .eq('user_id', user.id)
        .order('last_message_at', { foreignTable: 'chat_rooms', ascending: false });

      if (error) throw error;
      
      if (!roomsData) {
        setChats([]);
        return;
      }

      const validData = roomsData.filter(r => r && r.room);

      const friendUUIDs = validData
        .filter(r => r.room.type === 'individual' && r.room.id?.includes('_'))
        .map(r => r.room.id.split('_').find((id: string) => id !== user.id))
        .filter((id): id is string => !!id && id.length > 20);

      let usersData: UserProfile[] = [];
      let friendsData: Friend[] = [];

      if (friendUUIDs.length > 0) {
        const [usersResult, friendsResult] = await Promise.all([
          supabase
            .from('users')
            .select('id, name, avatar')
            .in('id', friendUUIDs),
          supabase
            .from('friends')
            .select('id, friend_user_id, name, avatar')
            .eq('user_id', user.id)
            .in('friend_user_id', friendUUIDs)
        ]);

        if (usersResult.data) usersData = usersResult.data;
        if (friendsResult.data) friendsData = friendsResult.data;
      }

      const formattedData = validData.map((member: any): ChatRoom | null => {
        const room = member.room;
        if (!room) return null;

        const isGroup = room.type === 'group';
        const friendIdFromRoom = !isGroup ? room.id.split('_').find((id: string) => id !== user.id) : null;
        
        const userProfile = !isGroup ? usersData.find(u => u.id === friendIdFromRoom) : null;
        const friendProfile = !isGroup ? friendsData.find(f => f.friend_user_id === friendIdFromRoom) : null;
        
        return {
          id: room.id.toString(),
          type: room.type || 'individual',
          title: isGroup 
            ? room.title 
            : (userProfile?.name || friendProfile?.name || room.title || '알 수 없는 사용자'),
          avatar: !isGroup && userProfile 
            ? userProfile.avatar 
            : (!isGroup && friendProfile ? friendProfile.avatar : (room.avatar || null)),
          membersCount: room.members_count || (isGroup ? 3 : 1),
          lastMessage: room.last_message || '대화를 시작해보세요!',
          timestamp: room.last_message_at 
            ? new Date(room.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unreadCount: member.unread_count || 0,
          isMuted: false
        };
      }).filter((chat): chat is ChatRoom => chat !== null);
      
      setChats(formattedData);
    } catch (error) {
      console.error('Fetch Chats Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    
    fetchChats();

    const channel = supabase
      .channel(`chat_list_realtime_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMsg = payload.new as any;
          
          setChats(prevChats => {
            const chatIndex = prevChats.findIndex(c => c.id === newMsg.room_id);
            
            if (chatIndex === -1) {
              fetchChats();
              return prevChats;
            }

            const updatedChats = [...prevChats];
            const chatToUpdate = { ...updatedChats[chatIndex] };
            
            chatToUpdate.lastMessage = newMsg.content;
            chatToUpdate.timestamp = new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            if (newMsg.sender_id !== user.id) {
              chatToUpdate.unreadCount = (chatToUpdate.unreadCount || 0) + 1;
            }

            updatedChats.splice(chatIndex, 1);
            updatedChats.unshift(chatToUpdate);
            
            return updatedChats;
          });
        }
      )
      .on(
        'postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'room_members', 
          filter: `user_id=eq.${user.id}` 
        }, 
        () => {
          fetchChats();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_rooms'
        },
        (payload) => {
          fetchChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchChats]);

  const fetchFriends = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('friends')
        .select('id, friend_user_id, name, avatar')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      
      if (error) throw error;
      if (data) setFriendsList(data);
    } catch (error) {
      console.error('Fetch Friends Error:', error);
    }
  }, [user]);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const handleLeaveChatClick = (chat: ChatRoom) => {
    setLeaveChatTarget(chat);
  };

  const handleLeaveChatConfirm = async () => {
    if (!user?.id || !leaveChatTarget) return;
    
    setChats(prev => prev.filter(chat => chat.id !== leaveChatTarget.id));
    setLeaveChatTarget(null);
    
    try {
      const { error } = await supabase
        .from('room_members')
        .delete()
        .match({ room_id: leaveChatTarget.id, user_id: user.id });

      if (error) throw error;

      const { count: remainingCount } = await supabase
        .from('room_members')
        .select('count(*)', { count: 'exact', head: true })
        .eq('room_id', leaveChatTarget.id);

      if (remainingCount === 0) {
        await supabase.from('chat_rooms').delete().eq('id', leaveChatTarget.id);
      } else {
        await supabase
          .from('chat_rooms')
          .update({ members_count: remainingCount })
          .eq('id', leaveChatTarget.id);
      }

      toast.success('채팅방을 나갔습니다.');
    } catch (error) {
      console.error('Leave Chat Error:', error);
      toast.error('나가기에 실패했습니다.');
      fetchChats();
    }
  };

  const handleMarkAsRead = async (id: string) => {
    if (!user?.id) return;
    
    setChats(prev => prev.map(chat => 
      chat.id === id ? { ...chat, unreadCount: 0 } : chat
    ));
    
    try {
      await supabase
        .from('room_members')
        .update({ unread_count: 0 })
        .match({ room_id: id, user_id: user.id });
    } catch (error) {
      console.error('Mark as Read Error:', error);
    }
  };

  const handleSaveTitle = async (newTitle: string) => {
    if (!editingChat || !user?.id) return;
    
    setChats(prev => prev.map(c => 
      c.id === editingChat.id ? { ...c, title: newTitle } : c
    ));
    setIsEditModalOpen(false);
    
    try {
      await supabase
        .from('chat_rooms')
        .update({ title: newTitle })
        .eq('id', editingChat.id);

      toast.success('이름이 변경되었습니다.');
    } catch (error) {
      console.error('Save Title Error:', error);
      toast.error('이름 변경에 실패했습니다.');
    }
  };

  const handleChatCreated = (newChatId: string) => {
    setIsCreateChatOpen(false);
    fetchChats(); 
    navigate(`/chat/room/${newChatId}`);
  };

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase();
    return chats.filter(chat => 
      chat.title.toLowerCase().includes(query) || 
      chat.lastMessage.toLowerCase().includes(query)
    );
  }, [chats, searchQuery]);

  return (
    <div className="w-full h-full flex flex-col bg-dark-bg text-white">
      <header className="h-14 px-4 flex items-center justify-between bg-dark-bg sticky top-0 z-50 border-b border-[#2C2C2E] shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold ml-1">채팅</h1>
          <span className="text-xl font-bold text-brand-DEFAULT ml-1">
            {chats.reduce((acc, curr) => acc + curr.unreadCount, 0) || ''}
          </span>
        </div>
        <div className="flex gap-1 relative">
          <button 
            onClick={() => setIsSearching(!isSearching)} 
            className={`p-2 transition-colors ${isSearching ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}
            aria-label="검색"
          >
            <Search className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setIsCreateChatOpen(true)} 
            className="p-2 text-white hover:text-brand-DEFAULT transition-colors"
            aria-label="새 채팅"
          >
            <Plus className="w-6 h-6" />
          </button>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)} 
            className={`p-2 transition-colors ${isSettingsOpen ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}
            aria-label="설정"
          >
            <Settings className="w-6 h-6" />
          </button>
          <AnimatePresence>
            {isSettingsOpen && (
              <>
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSettingsOpen(false)} />
                <motion.div 
                  initial={{ opacity: 0, y: -10, scale: 0.95 }} 
                  animate={{ opacity: 1, y: 0, scale: 1 }} 
                  exit={{ opacity: 0, y: -10, scale: 0.95 }} 
                  transition={{ duration: 0.15 }} 
                  className="absolute top-10 right-0 w-40 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl shadow-xl z-50 overflow-hidden py-1.5"
                >
                  <button 
                    onClick={() => { navigate('/settings/friends'); setIsSettingsOpen(false); }} 
                    className="w-full text-left px-4 py-2.5 text-[14px] text-white hover:bg-[#3A3A3C] transition-colors"
                  >
                    친구 관리
                  </button>
                  <div className="h-[1px] bg-[#3A3A3C] mx-3 my-1" />
                  <button 
                    onClick={() => { navigate('/main/settings'); setIsSettingsOpen(false); }} 
                    className="w-full text-left px-4 py-2.5 text-[14px] text-white hover:bg-[#3A3A3C] transition-colors"
                  >
                    전체 설정
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      <AnimatePresence>
        {isSearching && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="overflow-hidden px-5 py-2 bg-dark-bg shrink-0"
          >
            <div className="bg-[#2C2C2E] rounded-xl flex items-center px-4 py-2">
              <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
              <input 
                type="text" 
                placeholder="채팅방 이름, 메시지 검색" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="bg-transparent text-white placeholder-[#636366] text-sm w-full focus:outline-none" 
                autoFocus 
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X className="w-4 h-4 text-[#8E8E93]" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <RefreshCw className="animate-spin text-brand-DEFAULT" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-[#8E8E93] gap-3">
            <Search className="w-12 h-12 opacity-20" />
            <p className="text-sm">{searchQuery ? '검색 결과가 없습니다.' : '대화방이 없습니다.'}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredChats.map(chat => (
              <ChatListItem 
                key={chat.id} 
                data={chat} 
                onLeave={() => handleLeaveChatClick(chat)} 
                onRead={() => handleMarkAsRead(chat.id)} 
                onEditTitle={() => { setEditingChat(chat); setIsEditModalOpen(true); }} 
              />
            ))}
          </div>
        )}
      </div>

      <EditTitleModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        currentTitle={editingChat?.title || ''} 
        onSave={handleSaveTitle} 
      />
      <CreateChatModal 
        isOpen={isCreateChatOpen} 
        onClose={() => setIsCreateChatOpen(false)} 
        friends={friendsList} 
        onCreated={handleChatCreated} 
      />
      <LeaveChatModal
        chat={leaveChatTarget}
        onClose={() => setLeaveChatTarget(null)}
        onConfirm={handleLeaveChatConfirm}
      />
    </div>
  );
}

function ChatListItem({ data, onLeave, onRead, onEditTitle }: { 
  data: ChatRoom; 
  onLeave: () => void; 
  onRead: () => void; 
  onEditTitle: () => void; 
}) {
  const navigate = useNavigate();
  const controls = useAnimation();
  const isGroup = data.type === 'group';
  const SWIPE_WIDTH = isGroup ? -210 : -140;

  return (
    <div className="relative w-full h-[84px] overflow-hidden border-b border-[#2C2C2E] bg-dark-bg">
      <div className="absolute inset-y-0 right-0 flex h-full z-0" style={{ width: isGroup ? '210px' : '140px' }}>
        {isGroup && (
          <button 
            onClick={() => { onEditTitle(); controls.start({ x: 0 }); }} 
            className="flex-1 bg-[#3A3A3C] flex flex-col items-center justify-center text-white"
          >
            <Pencil className="w-5 h-5 mb-1" />
            <span className="text-[10px]">이름변경</span>
          </button>
        )}
        <button 
          onClick={() => { onRead(); controls.start({ x: 0 }); }} 
          className="flex-1 bg-[#48484A] border-l border-[#2C2C2E] flex flex-col items-center justify-center text-white"
        >
          <Check className="w-5 h-5 mb-1" />
          <span className="text-[10px]">읽음</span>
        </button>
        <button 
          onClick={onLeave} 
          className="flex-1 bg-[#EC5022] flex flex-col items-center justify-center text-white"
        >
          <Trash2 className="w-5 h-5 mb-1" />
          <span className="text-[10px]">나가기</span>
        </button>
      </div>

      <motion.div 
        drag="x" 
        dragConstraints={{ left: SWIPE_WIDTH, right: 0 }} 
        dragElastic={0.1}
        onDragEnd={async (_, info) => { 
          if (info.offset.x < -50) await controls.start({ x: SWIPE_WIDTH }); 
          else await controls.start({ x: 0 }); 
        }} 
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest('button')) {
            navigate(`/chat/room/${data.id}`);
          }
        }}
        animate={controls} 
        className="relative w-full h-full bg-dark-bg flex items-center px-4 z-10 cursor-pointer active:bg-white/5 transition-colors"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="w-[52px] h-[52px] rounded-[20px] bg-[#3A3A3C] mr-4 flex items-center justify-center overflow-hidden border border-[#2C2C2E]">
          {data.avatar ? (
            <img src={data.avatar} className="w-full h-full object-cover" alt="" />
          ) : (
            isGroup ? <Users className="w-6 h-6 text-[#8E8E93]" /> : <UserIcon className="w-6 h-6 text-[#8E8E93]" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <h3 className="text-[16px] font-bold text-white truncate max-w-[180px]">{data.title}</h3>
              {isGroup && data.membersCount > 1 && (
                <span className="text-brand-DEFAULT text-sm font-bold">{data.membersCount}</span>
              )}
            </div>
            <span className="text-[11px] text-[#8E8E93]">{data.timestamp}</span>
          </div>
          <div className="flex justify-between items-center">
            <p className="text-[13px] text-[#8E8E93] truncate max-w-[220px]">{data.lastMessage}</p>
            {data.unreadCount > 0 && (
              <div className="bg-[#EC5022] min-w-[18px] h-[18px] px-1.5 rounded-full flex items-center justify-center">
                <span className="text-[10px] font-bold text-white leading-none">
                  {data.unreadCount > 999 ? '+999' : data.unreadCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function LeaveChatModal({ chat, onClose, onConfirm }: { 
  chat: ChatRoom | null; 
  onClose: () => void; 
  onConfirm: () => void; 
}) {
  if (!chat) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        onClick={(e) => e.stopPropagation()} 
        className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E]"
      >
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-[#EC5022]/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-[#EC5022]" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">채팅방을 나가시겠습니까?</h3>
          <p className="text-xs text-[#8E8E93] leading-relaxed">
            대화 내용이 삭제되며<br/>목록에서 사라집니다.
          </p>
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button 
            onClick={onClose} 
            className="flex-1 text-[#8E8E93] font-medium text-[15px] hover:bg-[#2C2C2E] transition-colors border-r border-[#3A3A3C]"
          >
            취소
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 text-[#EC5022] font-bold text-[15px] hover:bg-[#2C2C2E] transition-colors"
          >
            나가기
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CreateChatModal({ isOpen, onClose, friends, onCreated }: { 
  isOpen: boolean; 
  onClose: () => void; 
  friends: Friend[]; 
  onCreated?: (id: string) => void; 
}) {
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { 
    if (isOpen) {
      setSelectedIds([]);
      setSearchTerm(''); 
    }
  }, [isOpen]);

  const filteredFriends = useMemo(() => {
    if (!searchTerm.trim()) return friends;
    const query = searchTerm.toLowerCase();
    return friends.filter(f => f.name.toLowerCase().includes(query));
  }, [friends, searchTerm]);

  const handleCreate = async () => { 
    if (selectedIds.length === 0 || !user?.id) {
      toast.error('상대를 선택해주세요.');
      return;
    }
    
    try {
      const isGroup = selectedIds.length > 1;
      let roomId = "";

      if (!isGroup) {
        const friendId = friends.find(f => f.id === selectedIds[0])?.friend_user_id;
        if (!friendId) throw new Error("Friend ID not found");

        roomId = [user.id, friendId].sort().join("_");

        const { data: existingRoom } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('id', roomId)
          .maybeSingle();

        if (existingRoom) {
          if (onCreated) onCreated(roomId);
          return;
        }

        const { error: roomError } = await supabase
          .from('chat_rooms')
          .insert([{ 
            id: roomId,
            title: friends.find(f => f.id === selectedIds[0])?.name || '새 대화',
            type: 'individual',
            created_by: user.id,
            last_message: '대화를 시작해보세요!',
            members_count: 2
          }]);

        if (roomError) throw roomError;

        const { error: membersError } = await supabase
          .from('room_members')
          .insert([
            { room_id: roomId, user_id: user.id, unread_count: 0 },
            { room_id: roomId, user_id: friendId, unread_count: 0 }
          ]);

        if (membersError) throw membersError;

      } else {
        roomId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        
        const title = `나 외 ${selectedIds.length}명`;

        const { error: roomError } = await supabase
          .from('chat_rooms')
          .insert([{ 
            id: roomId,
            title: title,
            type: 'group',
            created_by: user.id,
            last_message: '대화를 시작해보세요!',
            members_count: selectedIds.length + 1
          }]);

        if (roomError) throw roomError;

        const memberInserts = [
          { room_id: roomId, user_id: user.id, unread_count: 0 }
        ];

        selectedIds.forEach(selected => {
          const friendId = friends.find(f => f.id === selected)?.friend_user_id;
          if (friendId) {
            memberInserts.push({ room_id: roomId, user_id: friendId, unread_count: 0 });
          }
        });

        const { error: membersError } = await supabase
          .from('room_members')
          .insert(memberInserts);

        if (membersError) throw membersError;
      }

      toast.success('채팅방이 생성되었습니다.');
      
      if (onCreated) onCreated(roomId);

    } catch (error: any) {
      console.error('Create Chat Error:', error);
      toast.error(error.message?.includes('duplicate key') 
        ? '이미 존재하는 채팅방입니다.' 
        : '채팅방 생성에 실패했습니다.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ y: 50, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        onClick={e => e.stopPropagation()} 
        className="relative z-10 w-full max-w-[340px] bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E] shadow-2xl h-[540px] flex flex-col overflow-hidden"
      >
        <div className="h-14 bg-[#2C2C2E] flex items-center justify-between px-4 shrink-0">
          <span /> 
          <h3 className="text-white font-bold">대화상대 선택</h3> 
          <button onClick={onClose}>
            <X className="w-6 h-6 text-[#8E8E93]" />
          </button>
        </div>
        <div className="px-4 py-3 bg-[#1C1C1E] border-b border-[#2C2C2E]">
          <div className="bg-[#2C2C2E] rounded-xl flex items-center px-3 py-2">
            <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
            <input 
              type="text" 
              placeholder="이름으로 검색" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              className="bg-transparent text-white placeholder-[#636366] text-sm w-full focus:outline-none" 
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')}>
                <X className="w-4 h-4 text-[#8E8E93]" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar bg-[#1C1C1E]">
          {filteredFriends.map(f => {
            const isSelected = selectedIds.includes(f.id);
            return (
              <div 
                key={f.id} 
                onClick={() => setSelectedIds(prev => 
                  prev.includes(f.id) ? prev.filter(id => id !== f.id) : [...prev, f.id]
                )} 
                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                  isSelected ? 'bg-brand-DEFAULT/10' : 'hover:bg-white/5'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">
                  {f.avatar ? (
                    <img src={f.avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <UserIcon className="w-5 h-5 m-auto mt-2.5 opacity-50" />
                  )}
                </div>
                <p className={`flex-1 text-sm font-medium ${isSelected ? 'text-brand-DEFAULT' : 'text-white'}`}>
                  {f.name}
                </p>
                {isSelected ? (
                  <CheckCircle2 className="text-brand-DEFAULT w-5 h-5 fill-brand-DEFAULT/10" />
                ) : (
                  <Circle className="w-5 h-5 text-[#3A3A3C]" />
                )}
              </div>
            );
          })}
        </div>
        <div className="p-4 border-t border-[#2C2C2E] bg-[#1C1C1E] shrink-0">
          <button 
            onClick={handleCreate} 
            disabled={selectedIds.length === 0} 
            className="w-full h-12 rounded-xl bg-brand-DEFAULT font-bold text-white transition-all disabled:opacity-30 disabled:grayscale"
          >
            채팅 시작하기 ({selectedIds.length})
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function EditTitleModal({ isOpen, onClose, currentTitle, onSave }: { 
  isOpen: boolean; 
  onClose: () => void; 
  currentTitle: string; 
  onSave: (val: string) => void; 
}) {
  const [text, setText] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => { 
    if (isOpen) { 
      setText(currentTitle); 
      setTimeout(() => inputRef.current?.focus(), 100); 
    } 
  }, [isOpen, currentTitle]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        onClick={e => e.stopPropagation()} 
        className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] rounded-2xl p-6 border border-[#3A3A3C]"
      >
        <h3 className="text-white font-bold text-lg mb-4 text-center">이름 변경</h3>
        <input 
          ref={inputRef} 
          type="text" 
          value={text} 
          onChange={e => setText(e.target.value)} 
          className="w-full bg-[#2C2C2E] text-white p-3 rounded-xl mb-6 focus:outline-none" 
        />
        <div className="flex gap-3">
          <button 
            onClick={onClose} 
            className="flex-1 h-11 rounded-xl bg-[#3A3A3C] text-white"
          >
            취소
          </button>
          <button 
            onClick={() => onSave(text)} 
            className="flex-1 h-11 rounded-xl bg-brand-DEFAULT text-white font-bold"
          >
            확인
          </button>
        </div>
      </motion.div>
    </div>
  );
}