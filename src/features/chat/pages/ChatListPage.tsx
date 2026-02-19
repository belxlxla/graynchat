import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import { 
  User as UserIcon, Users, 
  Trash2, Check, Search, Plus, Pencil, X,
  CheckCircle2, Circle, Settings, RefreshCw, AlertTriangle,
  MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

// ─── 타입 ────────────────────────────────────────────────────
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

// ─── 공통 바텀시트 래퍼 ──────────────────────────────────────
function BottomSheet({ isOpen, onClose, children, maxH = 'max-h-[85vh]' }: {
  isOpen: boolean; onClose: () => void; children: React.ReactNode; maxH?: string;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320, mass: 0.9 }}
            className={`relative z-10 bg-[#1c1c1c] rounded-t-[28px] ${maxH} flex flex-col overflow-hidden`}
            onClick={e => e.stopPropagation()}
          >
            {/* handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-9 h-[3px] bg-white/15 rounded-full" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ─── 아바타 ──────────────────────────────────────────────────
function Avatar({ src, isGroup, size = 48, radius = 17 }: {
  src: string | null; isGroup?: boolean; size?: number; radius?: number;
}) {
  return (
    <div
      className="bg-[#2e2e2e] flex items-center justify-center overflow-hidden border border-white/[0.06] shrink-0"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {src
        ? <img src={src} className="w-full h-full object-cover" alt="" />
        : isGroup
          ? <Users style={{ width: size * 0.44, height: size * 0.44 }} className="text-white/30" />
          : <UserIcon style={{ width: size * 0.44, height: size * 0.44 }} className="text-white/30" />
      }
    </div>
  );
}

// ════════════════════════════════════════════════════════════
export default function ChatListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();

  const [chats, setChats]                     = useState<ChatRoom[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [friendsList, setFriendsList]         = useState<Friend[]>([]);
  const [isSearching, setIsSearching]         = useState(false);
  const [searchQuery, setSearchQuery]         = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChat, setEditingChat]         = useState<ChatRoom | null>(null);
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen]   = useState(false);
  const [leaveChatTarget, setLeaveChatTarget] = useState<ChatRoom | null>(null);

  // ── 채팅 목록 불러오기 ──────────────────────────────────
  const fetchChats = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: myMemberships, error: memberError } = await supabase
        .from('room_members').select('room_id').eq('user_id', user.id);
      if (memberError) throw memberError;
      if (!myMemberships || myMemberships.length === 0) { setChats([]); setIsLoading(false); return; }

      const roomIds = myMemberships.map(m => m.room_id);

      const { data: roomsData, error: roomsError } = await supabase
        .from('chat_rooms').select('*').in('id', roomIds).order('last_message_at', { ascending: false });
      if (roomsError) throw roomsError;

      const { data: myRoomMembers } = await supabase
        .from('room_members').select('room_id, unread_count')
        .eq('user_id', user.id).in('room_id', roomIds);

      const unreadMap = new Map(myRoomMembers?.map(m => [m.room_id, m.unread_count || 0]) || []);

      const individualRooms = roomsData?.filter(r => r.type === 'individual') || [];
      const friendUUIDs = individualRooms
        .map(r => r.id.split('_').find((id: string) => id !== user.id))
        .filter((id): id is string => !!id && id.length > 20);

      let usersMap = new Map<string, UserProfile>();
      if (friendUUIDs.length > 0) {
        const { data: usersData } = await supabase.from('users').select('id, name').in('id', friendUUIDs);
        const { data: profilesData } = await supabase.from('user_profiles').select('user_id, avatar_url').in('user_id', friendUUIDs);
        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
        usersData?.forEach(u => usersMap.set(u.id, {
          id: u.id,
          name: u.name,
          avatar: profilesMap.get(u.id)?.avatar_url || null,
        }));
      }

      const formattedData = (roomsData || []).map((room): ChatRoom | null => {
        if (!room) return null;
        const isGroup = room.type === 'group';
        let title = '알 수 없는 사용자';
        let avatar: string | null = null;

        if (isGroup) {
          title = room.title || '그룹 채팅';
          avatar = room.avatar;
        } else {
          const friendId = room.id.split('_').find((id: string) => id !== user.id);
          if (friendId) {
            const up = usersMap.get(friendId);
            if (up) { title = up.name; avatar = up.avatar; }
          }
        }

        return {
          id: room.id.toString(), type: room.type || 'individual', title, avatar,
          membersCount: room.members_count || (isGroup ? 3 : 1),
          lastMessage: room.last_message || '대화를 시작해보세요!',
          timestamp: room.last_message_at
            ? new Date(room.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          unreadCount: unreadMap.get(room.id) || 0, isMuted: false,
        };
      }).filter((c): c is ChatRoom => c !== null);

      const uniqueChats = formattedData.reduce((acc: ChatRoom[], chat) => {
        if (!acc.find(c => c.id === chat.id)) {
          acc.push(chat);
        }
        return acc;
      }, []);

      setChats(uniqueChats);
    } catch (error) {
      console.error('Fetch Chats Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // ✅ 경로 변경될 때마다 새로고침
  useEffect(() => {
    if (!user?.id) return;
    fetchChats();
  }, [location.pathname, user?.id, fetchChats]);

  // ✅ Realtime 구독 (안 읽은 메시지 수 유지 로직 추가)
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel(`chat_list_realtime_${user.id}_${Date.now()}`)
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages' }, 
        (payload) => {
          const newMsg = payload.new as any;
          setChats(prev => {
            const idx = prev.findIndex(c => c.id === newMsg.room_id);
            if (idx === -1) { 
              fetchChats(); 
              return prev; 
            }
            const updated = [...prev];
            const chat = { ...updated[idx] };
            chat.lastMessage = newMsg.content;
            chat.timestamp = new Date(newMsg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            // ✅ 상대방이 보낸 메시지인 경우 카운트 증가 (999+ 로직은 렌더링에서 처리)
            if (newMsg.sender_id !== user.id) {
              chat.unreadCount = (chat.unreadCount || 0) + 1;
            }
            
            updated.splice(idx, 1);
            updated.unshift(chat);
            return updated;
          });
        }
      )
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'room_members', filter: `user_id=eq.${user.id}` }, 
        () => { fetchChats(); }
      )
      .on('postgres_changes', 
        { event: 'DELETE', schema: 'public', table: 'room_members', filter: `user_id=eq.${user.id}` }, 
        () => { fetchChats(); }
      )
      // ✅ [중요 수정] chat_rooms 업데이트 시 fetchChats() 대신 로컬 상태 병합
      // 이렇게 해야 INSERT 이벤트에서 올린 unreadCount가 초기화되지 않음
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'chat_rooms' }, 
        (payload) => {
          const updatedRoom = payload.new as any;
          setChats(prev => prev.map(chat => {
            if (chat.id === updatedRoom.id) {
              return {
                ...chat,
                title: updatedRoom.title,
                // unreadCount는 건드리지 않고 유지함
                lastMessage: updatedRoom.last_message || chat.lastMessage,
                timestamp: updatedRoom.last_message_at 
                  ? new Date(updatedRoom.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : chat.timestamp
              };
            }
            return chat;
          }));
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'users' },
        () => fetchChats()
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_profiles' },
        () => fetchChats()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchChats]);

  const fetchFriends = useCallback(async () => {
    if (!user?.id) return;
    try {
const { data: friendsData, error } = await supabase
  .from('friends').select('id, friend_user_id, name')
  .eq('user_id', user.id).order('name', { ascending: true });
      if (error) throw error;

      if (friendsData && friendsData.length > 0) {
        const uuids = friendsData.map(f => f.friend_user_id).filter(Boolean);
        const { data: usersData } = await supabase.from('users').select('id, name').in('id', uuids);
        const { data: profilesData } = await supabase.from('user_profiles').select('user_id, avatar_url').in('user_id', uuids);
        const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
        setFriendsList(friendsData.map(f => ({
          id: f.id,
          friend_user_id: f.friend_user_id,
          name: usersMap.get(f.friend_user_id)?.name || f.name,
          avatar: profilesMap.get(f.friend_user_id)?.avatar_url || null,
        })));
      } else {
        setFriendsList([]);
      }
    } catch (error) { console.error('Fetch Friends Error:', error); }
  }, [user]);

  useEffect(() => { fetchFriends(); }, [fetchFriends]);

  // ✅ 채팅방 나가기: 메시지 삭제 + AI 점수 초기화 + 나가기
  const handleLeaveChatConfirm = async () => {
    if (!user?.id || !leaveChatTarget) return;

    const targetRoomId = leaveChatTarget.id;
    const isIndividual = leaveChatTarget.type === 'individual';

    setChats(prev => prev.filter(c => c.id !== targetRoomId));
    setLeaveChatTarget(null);
    
    try {
      if (isIndividual) {
        const friendId = targetRoomId.split('_').find(id => id !== user.id);
        if (friendId) {
           await supabase.from('friends')
             .update({ friendly_score: 1 })
             .match({ user_id: user.id, friend_user_id: friendId });
        }
      }

      await supabase.from('messages').delete().eq('room_id', targetRoomId);

      const { error: deleteMemberError } = await supabase
        .from('room_members')
        .delete()
        .match({ room_id: targetRoomId, user_id: user.id });
      
      if (deleteMemberError) throw deleteMemberError;
      
      const { count } = await supabase
        .from('room_members')
        .select('count(*)', { count: 'exact', head: true })
        .eq('room_id', targetRoomId);
      
      if (count === 0) {
        await supabase.from('chat_rooms').delete().eq('id', targetRoomId);
      } else {
        await supabase.from('chat_rooms').update({ members_count: count }).eq('id', targetRoomId);
      }
      
      toast.success('채팅방을 나갔습니다.');
      
    } catch (error) {
      console.error('나가기 실패:', error);
      toast.error('나가기에 실패했습니다.');
      fetchChats(); 
    }
  };

  const handleMarkAsRead = async (id: string) => {
    if (!user?.id) return;
    setChats(prev => prev.map(c => c.id === id ? { ...c, unreadCount: 0 } : c));
    try {
      await supabase.from('room_members').update({ unread_count: 0 }).match({ room_id: id, user_id: user.id });
    } catch { console.error('Mark as Read Error'); }
  };

  const handleSaveTitle = async (newTitle: string) => {
    if (!editingChat || !user?.id) return;
    setChats(prev => prev.map(c => c.id === editingChat.id ? { ...c, title: newTitle } : c));
    setIsEditModalOpen(false);
    try {
      await supabase.from('chat_rooms').update({ title: newTitle }).eq('id', editingChat.id);
      toast.success('이름이 변경되었습니다.');
    } catch { toast.error('이름 변경에 실패했습니다.'); }
  };

  const handleChatCreated = (newChatId: string) => {
    setIsCreateChatOpen(false);
    fetchChats();
    navigate(`/chat/room/${newChatId}`);
  };

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const q = searchQuery.toLowerCase();
    return chats.filter(c => c.title.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q));
  }, [chats, searchQuery]);

  const totalUnread = chats.reduce((a, c) => a + c.unreadCount, 0);

  return (
    <div className="w-full h-full flex flex-col bg-[#212121] text-white">

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <header className="h-[56px] px-5 flex items-center justify-between bg-[#212121] sticky top-0 z-50 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-bold tracking-tight">채팅</h1>
          {totalUnread > 0 && (
            <motion.span
              initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="text-[13px] font-bold text-[#FF203A] bg-[#FF203A]/12 px-2 py-0.5 rounded-full tabular-nums"
            >
              {totalUnread > 999 ? '+999' : totalUnread}
            </motion.span>
          )}
        </div>

        <div className="flex items-center gap-1 relative">
          {/* 검색 */}
          <button
            onClick={() => setIsSearching(v => !v)}
            className={`w-9 h-9 flex items-center justify-center rounded-[12px] transition-colors ${
              isSearching ? 'bg-[#FF203A]/15 text-[#FF203A]' : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <Search className="w-[19px] h-[19px]" />
          </button>

          {/* 새 채팅 */}
          <button
            onClick={() => setIsCreateChatOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-[12px] text-white/60 hover:bg-white/[0.06] hover:text-white transition-colors"
          >
            <Plus className="w-[19px] h-[19px]" />
          </button>

          {/* 설정 */}
          <button
            onClick={() => setIsSettingsOpen(v => !v)}
            className={`w-9 h-9 flex items-center justify-center rounded-[12px] transition-colors ${
              isSettingsOpen ? 'bg-[#FF203A]/15 text-[#FF203A]' : 'text-white/60 hover:bg-white/[0.06] hover:text-white'
            }`}
          >
            <Settings className="w-[19px] h-[19px]" />
          </button>

          {/* 설정 드롭다운 */}
          <AnimatePresence>
            {isSettingsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSettingsOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.94 }}
                  transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute top-11 right-0 w-[148px] bg-[#2a2a2a] border border-white/[0.07] rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 overflow-hidden py-1"
                >
                  <button
                    onClick={() => { navigate('/settings/friends'); setIsSettingsOpen(false); }}
                    className="w-full text-left px-4 py-3 text-[13.5px] text-white/85 hover:bg-white/[0.06] transition-colors"
                  >
                    친구 관리
                  </button>
                  <div className="h-px bg-white/[0.06] mx-3" />
                  <button
                    onClick={() => { navigate('/main/settings'); setIsSettingsOpen(false); }}
                    className="w-full text-left px-4 py-3 text-[13.5px] text-white/85 hover:bg-white/[0.06] transition-colors"
                  >
                    전체 설정
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* ── 검색 바 ───────────────────────────────────────── */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden px-4 shrink-0"
          >
            <div className="pb-3">
              <div className="bg-[#2c2c2c] rounded-[14px] flex items-center gap-2 px-3.5 h-[42px] border border-white/[0.05]">
                <Search className="w-4 h-4 text-white/30 shrink-0" />
                <input
                  type="text"
                  placeholder="채팅방 이름, 메시지 검색"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-transparent text-white/90 placeholder-white/25 text-[14px] w-full focus:outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="shrink-0">
                    <X className="w-4 h-4 text-white/30" />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 채팅 목록 ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex justify-center items-center h-48">
            <RefreshCw className="w-5 h-5 animate-spin text-[#FF203A]/60" />
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[55vh] gap-4">
            <div className="w-16 h-16 rounded-[22px] bg-white/[0.04] flex items-center justify-center">
              <MessageSquare className="w-7 h-7 text-white/20" />
            </div>
            <p className="text-[14px] text-white/30">
              {searchQuery ? '검색 결과가 없습니다.' : '아직 채팅방이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="pb-4">
            {filteredChats.map((chat, i) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
              >
                <ChatListItem
                  data={chat}
                  onLeave={() => setLeaveChatTarget(chat)}
                  onRead={() => handleMarkAsRead(chat.id)}
                  onEditTitle={() => { setEditingChat(chat); setIsEditModalOpen(true); }}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── 모달들 ───────────────────────────────────────── */}
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

// ════════════════════════════════════════════════════════════
// 채팅 리스트 아이템
// ════════════════════════════════════════════════════════════
function ChatListItem({ data, onLeave, onRead, onEditTitle }: {
  data: ChatRoom; onLeave: () => void; onRead: () => void; onEditTitle: () => void;
}) {
  const navigate = useNavigate();
  const controls = useAnimation(); // ✅ useAnimation 정상 동작
  const isGroup = data.type === 'group';

  // 그룹: 이름변경 + 읽음 + 나가기 = 3칸 (216px)
  // 개인: 읽음 + 나가기 = 2칸 (144px)
  const ACTIONS_WIDTH = isGroup ? 216 : 144;
  const SWIPE_THRESHOLD = -50;

  return (
    <div className="relative overflow-hidden" style={{ height: 76 }}>

      {/* ── 스와이프 액션 배경 ─ */}
      <div
        className="absolute inset-y-0 right-0 flex"
        style={{ width: ACTIONS_WIDTH }}
      >
        {isGroup && (
          <button
            onClick={() => { onEditTitle(); controls.start({ x: 0, transition: { type: 'spring', damping: 28, stiffness: 320 } }); }}
            className="flex-1 flex flex-col items-center justify-center gap-1 bg-[#3a3a3a]"
          >
            <Pencil className="w-[17px] h-[17px] text-white/80" />
            <span className="text-[10px] text-white/60 font-medium">이름변경</span>
          </button>
        )}
        <button
          onClick={() => { onRead(); controls.start({ x: 0, transition: { type: 'spring', damping: 28, stiffness: 320 } }); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-[#2e2e2e]"
        >
          <Check className="w-[17px] h-[17px] text-white/80" />
          <span className="text-[10px] text-white/60 font-medium">읽음</span>
        </button>
        <button
          onClick={onLeave}
          className="flex-1 flex flex-col items-center justify-center gap-1 bg-[#FF203A]"
        >
          <Trash2 className="w-[17px] h-[17px] text-white" />
          <span className="text-[10px] text-white/80 font-medium">나가기</span>
        </button>
      </div>

      {/* ── 메인 카드 ─ */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -ACTIONS_WIDTH, right: 0 }}
        dragElastic={0.06}
        onDragEnd={async (_, info) => {
          if (info.offset.x < SWIPE_THRESHOLD)
            await controls.start({ x: -ACTIONS_WIDTH, transition: { type: 'spring', damping: 28, stiffness: 320 } });
          else
            await controls.start({ x: 0, transition: { type: 'spring', damping: 28, stiffness: 320 } });
        }}
        onClick={e => {
          if (!(e.target as HTMLElement).closest('button')) navigate(`/chat/room/${data.id}`);
        }}
        animate={controls}
        className="absolute inset-0 bg-[#212121] flex items-center px-4 cursor-pointer z-10 active:bg-white/[0.03] transition-colors"
        style={{ touchAction: 'pan-y' }}
      >
        {/* 아바타 */}
        <div className="relative mr-3 shrink-0">
          <Avatar src={data.avatar} isGroup={isGroup} size={50} radius={17} />
        </div>

        {/* 텍스트 */}
        <div className="flex-1 min-w-0 py-1">
          <div className="flex items-center justify-between mb-[3px]">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 mr-3">
              <span className="text-[15.5px] font-semibold text-white truncate leading-tight">
                {data.title}
              </span>
              {isGroup && data.membersCount > 1 && (
                <span className="text-[12px] font-semibold text-[#FF203A]/90 shrink-0">{data.membersCount}</span>
              )}
            </div>
            <span className="text-[11px] text-white/28 shrink-0 tabular-nums">{data.timestamp}</span>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-white/38 truncate flex-1 mr-3 leading-tight">{data.lastMessage}</p>
            {data.unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0.5 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                className="bg-[#FF203A] min-w-[19px] h-[19px] px-[5px] rounded-full flex items-center justify-center shrink-0"
              >
                {/* ✅ 요구사항: 999 넘으면 +999 로 표기 */}
                <span className="text-[10px] font-bold text-white leading-none tabular-nums">
                  {data.unreadCount > 999 ? '+999' : data.unreadCount}
                </span>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* 구분선 */}
      <div className="absolute bottom-0 left-[70px] right-0 h-px bg-white/[0.04] z-20 pointer-events-none" />
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// 채팅방 나가기 바텀시트
// ════════════════════════════════════════════════════════════
function LeaveChatModal({ chat, onClose, onConfirm }: {
  chat: ChatRoom | null; onClose: () => void; onConfirm: () => void;
}) {
  return (
    <BottomSheet isOpen={!!chat} onClose={onClose} maxH="max-h-[42vh]">
      <div className="px-6 pt-4 pb-3 text-center">
        {/* 아이콘 */}
        <div className="w-14 h-14 rounded-[20px] bg-[#FF203A]/10 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-6 h-6 text-[#FF203A]" />
        </div>
        <h3 className="text-[18px] font-bold text-white mb-2 tracking-tight">채팅방을 나갈까요?</h3>
        <p className="text-[13.5px] text-white/38 leading-relaxed">
          {chat?.type === 'individual' 
            ? '1:1 채팅방의 모든 대화 내용이 삭제되며\n채팅 목록에서 사라집니다.'
            : '채팅방에서 나가면\n채팅 목록에서 사라집니다.'}
        </p>
      </div>
      <div className="px-4 pb-8 pt-2 flex gap-2.5 shrink-0">
        <button
          onClick={onClose}
          className="flex-1 h-[50px] bg-[#2c2c2c] text-white/70 font-semibold rounded-2xl text-[15px] hover:bg-[#333] transition-colors"
        >
          취소
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 h-[50px] bg-[#FF203A] text-white font-bold rounded-2xl text-[15px] hover:bg-[#e0001c] transition-colors"
        >
          나가기
        </button>
      </div>
    </BottomSheet>
  );
}

// ════════════════════════════════════════════════════════════
// 채팅방 만들기 바텀시트
// ════════════════════════════════════════════════════════════
function CreateChatModal({ isOpen, onClose, friends, onCreated }: {
  isOpen: boolean; onClose: () => void; friends: Friend[]; onCreated?: (id: string) => void;
}) {
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [searchTerm, setSearchTerm]   = useState('');

  useEffect(() => { if (isOpen) { setSelectedIds([]); setSearchTerm(''); } }, [isOpen]);

  const filteredFriends = useMemo(() => {
    if (!searchTerm.trim()) return friends;
    const q = searchTerm.toLowerCase();
    return friends.filter(f => f.name.toLowerCase().includes(q));
  }, [friends, searchTerm]);

  const toggle = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleCreate = async () => {
    if (selectedIds.length === 0 || !user?.id) { toast.error('상대를 선택해주세요.'); return; }
    try {
      const isGroup = selectedIds.length > 1;
      let roomId = '';

      if (!isGroup) {
        const friendId = friends.find(f => f.id === selectedIds[0])?.friend_user_id;
        if (!friendId) throw new Error('Friend ID not found');
        roomId = [user.id, friendId].sort().join('_');

        const { data: existing } = await supabase.from('chat_rooms').select('id').eq('id', roomId).maybeSingle();
        if (existing) { 
          if (onCreated) onCreated(roomId); 
          return; 
        }

        const { data: fu } = await supabase.from('users').select('name').eq('id', friendId).maybeSingle();
        const friendName = fu?.name || friends.find(f => f.id === selectedIds[0])?.name || '새 대화';

        const { error: re } = await supabase.from('chat_rooms').insert([{
          id: roomId, title: friendName, type: 'individual',
          created_by: user.id, last_message: '대화를 시작해보세요!', members_count: 2,
        }]);
        if (re) throw re;

        const { error: me } = await supabase.from('room_members').insert([
          { room_id: roomId, user_id: user.id, unread_count: 0 },
          { room_id: roomId, user_id: friendId, unread_count: 0 },
        ]);
        if (me) throw me;

      } else {
        roomId = `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const title = `나 외 ${selectedIds.length}명`;

        const { error: re } = await supabase.from('chat_rooms').insert([{
          id: roomId, title, type: 'group', created_by: user.id,
          last_message: '대화를 시작해보세요!', members_count: selectedIds.length + 1,
        }]);
        if (re) throw re;

        const inserts = [{ room_id: roomId, user_id: user.id, unread_count: 0 }];
        selectedIds.forEach(sid => {
          const fid = friends.find(f => f.id === sid)?.friend_user_id;
          if (fid) inserts.push({ room_id: roomId, user_id: fid, unread_count: 0 });
        });

        const { error: me } = await supabase.from('room_members').insert(inserts);
        if (me) throw me;
      }

      toast.success('채팅방이 생성되었습니다.');
      if (onCreated) onCreated(roomId);
    } catch (error: any) {
      console.error('Create Chat Error:', error);
      toast.error(error.message?.includes('duplicate key') ? '이미 존재하는 채팅방입니다.' : '채팅방 생성에 실패했습니다.');
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxH="max-h-[88vh]">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 pb-4 pt-1 shrink-0">
        <h3 className="text-[18px] font-bold text-white tracking-tight">대화 상대 선택</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.06] text-white/50 hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* 검색 */}
      <div className="px-4 pb-3 shrink-0">
        <div className="bg-[#2c2c2c] rounded-[14px] flex items-center gap-2 px-3.5 h-[42px] border border-white/[0.05]">
          <Search className="w-4 h-4 text-white/30 shrink-0" />
          <input
            type="text"
            placeholder="이름으로 검색"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent text-white/90 placeholder-white/25 text-[14px] w-full focus:outline-none"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')}>
              <X className="w-4 h-4 text-white/30" />
            </button>
          )}
        </div>
      </div>

      {/* 선택된 수 표시 */}
      {selectedIds.length > 0 && (
        <div className="px-4 pb-2 shrink-0">
          <div className="flex items-center gap-2 text-[12px]">
            <div className="w-4 h-4 bg-[#FF203A] rounded-full flex items-center justify-center">
              <span className="text-[9px] font-bold text-white">{selectedIds.length}</span>
            </div>
            <span className="text-white/40">
              {selectedIds.length === 1 ? '1:1 채팅' : `그룹 채팅 (${selectedIds.length + 1}명)`}
            </span>
          </div>
        </div>
      )}

      {/* 친구 목록 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 min-h-0">
        {filteredFriends.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-white/25 gap-2">
            <Users className="w-8 h-8" />
            <p className="text-[13px]">친구가 없습니다.</p>
          </div>
        ) : (
          filteredFriends.map(f => {
            const selected = selectedIds.includes(f.id);
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-[16px] transition-colors text-left ${
                  selected ? 'bg-[#FF203A]/10' : 'hover:bg-white/[0.04]'
                }`}
              >
                <Avatar src={f.avatar} size={42} radius={14} />
                <span className={`flex-1 text-[14.5px] font-medium ${selected ? 'text-[#FF203A]' : 'text-white/85'}`}>
                  {f.name}
                </span>
                {selected
                  ? <CheckCircle2 className="w-[22px] h-[22px] text-[#FF203A] shrink-0" />
                  : <Circle className="w-[22px] h-[22px] text-white/15 shrink-0" />
                }
              </button>
            );
          })
        )}
      </div>

      {/* 시작 버튼 */}
      <div className="px-4 pt-3 pb-28 shrink-0">
        <button
          onClick={handleCreate}
          disabled={selectedIds.length === 0}
          className="w-full h-[52px] rounded-2xl bg-[#FF203A] text-white font-bold text-[15.5px] disabled:opacity-25 transition-opacity"
        >
          {selectedIds.length > 0 ? `${selectedIds.length}명과 채팅 시작` : '채팅 시작하기'}
        </button>
      </div>
    </BottomSheet>
  );
}

// ════════════════════════════════════════════════════════════
// 이름 변경 바텀시트
// ════════════════════════════════════════════════════════════
function EditTitleModal({ isOpen, onClose, currentTitle, onSave }: {
  isOpen: boolean; onClose: () => void; currentTitle: string; onSave: (v: string) => void;
}) {
  const [text, setText] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(currentTitle);
      setTimeout(() => inputRef.current?.focus(), 180);
    }
  }, [isOpen, currentTitle]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} maxH="max-h-[50vh]">
      <div className="px-5 pt-2 pb-2 shrink-0">
        <h3 className="text-[18px] font-bold text-white tracking-tight mb-5">이름 변경</h3>

        {/* 레이블 */}
        <p className="text-[11px] font-semibold text-white/30 uppercase tracking-widest mb-2">채팅방 이름</p>
        <div className="bg-[#2c2c2c] rounded-[14px] flex items-center px-4 h-[50px] border border-white/[0.05] mb-6">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSave(text); }}
            className="bg-transparent text-white text-[15px] w-full focus:outline-none"
            placeholder="채팅방 이름을 입력하세요"
          />
          {text && (
            <button onClick={() => setText('')} className="shrink-0 ml-2">
              <X className="w-4 h-4 text-white/30" />
            </button>
          )}
        </div>

        <div className="flex gap-2.5 pb-8">
          <button
            onClick={onClose}
            className="flex-1 h-[50px] bg-[#2c2c2c] text-white/65 font-semibold rounded-2xl text-[15px] hover:bg-[#333] transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onSave(text)}
            disabled={!text.trim()}
            className="flex-1 h-[50px] bg-[#FF203A] text-white font-bold rounded-2xl text-[15px] disabled:opacity-25 transition-opacity"
          >
            저장
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}