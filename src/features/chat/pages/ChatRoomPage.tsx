import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Send, MoreHorizontal, ShieldAlert, 
  Search, ChevronUp, ChevronDown, Plus, ImageIcon, 
  Camera, FileText, Smile, X, Download, AtSign, 
  User as UserIcon, UserPlus, Ban, Unlock, ExternalLink 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

// --- [Types] ---
interface Message { 
  id: number; 
  room_id: string; 
  sender_id: string; 
  content: string; 
  created_at: string; 
  is_read: boolean; 
}

interface MemberProfile { 
  id: string; 
  name: string; 
  avatar: string | null; 
}

export default function ChatRoomPage() {
  const { chatId } = useParams<{ chatId: string }>(); 
  const navigate = useNavigate();
  const { user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [roomTitle, setRoomTitle] = useState('대화 중...'); 
  const [isLoading, setIsLoading] = useState(true);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberProfile>>({});
  const [isFriend, setIsFriend] = useState<boolean>(true);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [inputText, setInputText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<{[key: number]: HTMLDivElement | null}>({});

  const isGroupChat = chatId?.startsWith('group_') ?? false;

  // 메시지 읽음 처리 함수
  const markAsRead = useCallback(async () => {
    if (!chatId || !user?.id) return;
    try {
      const { error } = await supabase
        .from('room_members')
        .update({ unread_count: 0 })
        .eq('room_id', chatId)
        .eq('user_id', user.id);

      if (error) {
        console.warn('[ChatRoom] 읽음 처리 스킵:', error.message);
      }
    } catch (err) {
      console.error('읽음 처리 중 예외:', err);
    }
  }, [chatId, user?.id]);

  const fetchInitialData = useCallback(async () => {
    if (!chatId || !user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      // 1. 채팅방 정보 가져오기
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .select('id, type, title, created_by, members_count')
        .eq('id', chatId)
        .maybeSingle();

      if (roomError) throw roomError;

      let memberIds: string[] = [];

      if (room) {
        // 기존 방이 있는 경우
        const { data: members, error: membersError } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', chatId);

        if (membersError) throw membersError;
        memberIds = members?.map(m => m.user_id) || [];
      } else {
        // 방이 없는 경우 (첫 대화 등)
        if (!isGroupChat) {
          const ids = chatId.split('_');
          memberIds = ids.filter(id => id.length > 0);
        }
      }

      // 3. 멤버 프로필 정보 가져오기
      if (memberIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('users')
          .select('id, name, avatar')
          .in('id', memberIds);

        if (profilesError) throw profilesError;

        const profileMap: Record<string, MemberProfile> = {};
        profiles?.forEach(p => {
          profileMap[p.id] = { id: p.id, name: p.name, avatar: p.avatar };
        });
        setMemberProfiles(profileMap);

        // 4. 방 제목 설정
        if (isGroupChat) {
          setRoomTitle(room?.title || `그룹 채팅 (${memberIds.length}명)`);
        } else {
          const friendId = memberIds.find(id => id !== user.id);
          if (friendId) {
            const friendProfile = profileMap[friendId];
            const { data: friendRecord } = await supabase
              .from('friends')
              .select('name, is_blocked')
              .eq('user_id', user.id)
              .eq('friend_user_id', friendId)
              .maybeSingle();

            if (friendRecord) {
              setRoomTitle(friendRecord.name || friendProfile?.name || '알 수 없는 사용자');
              setIsFriend(true);
              setIsBlocked(!!friendRecord.is_blocked);
            } else {
              setRoomTitle(friendProfile?.name || '알 수 없는 사용자');
              setIsFriend(false);
            }
          }
        }
      }

      // 5. 메시지 불러오기
      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', chatId)
        .order('created_at', { ascending: true });

      if (msgError) throw msgError;

      setMessages(msgData || []);
      
      if (room) {
        markAsRead();
      }

    } catch (e) {
      console.error("초기 데이터 로드 오류:", e);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, user?.id, isGroupChat, markAsRead]);

  useEffect(() => {
    fetchInitialData();

    if (!chatId || !user?.id) return;

    const handleVisibilityChange = () => {
      if (!document.hidden) markAsRead();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', markAsRead);

    const channel = supabase.channel(`room_messages_${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${chatId}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) {
              return prev;
            }
            const updated = [...prev, newMsg];
            setTimeout(() => {
              scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
            return updated;
          });

          if (newMsg.sender_id !== user.id) {
            setTimeout(markAsRead, 300);
          }
        }
      )
      .subscribe();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', markAsRead);
      supabase.removeChannel(channel);
    };
  }, [chatId, user?.id, fetchInitialData, markAsRead]);

  useEffect(() => {
    if (scrollRef.current && !isSearching) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSearching]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatId || !user || isBlocked) return;

    const textToSend = inputText.trim();
    setInputText(''); // UI 즉시 초기화

    try {
      // 1. 메시지 전송 (Messages 테이블 Insert)
      const { data: inserted, error: sendError } = await supabase
        .from('messages')
        .insert({
          room_id: chatId,
          sender_id: user.id,
          content: textToSend,
          is_read: false
        })
        .select()
        .single();

      if (sendError) throw sendError;

      // Optimistic Update
      if (inserted) {
        setMessages(prev => [...prev, inserted]);
      }

      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

      // 2. 방 정보 업데이트 (update)
      try {
        await supabase
          .from('chat_rooms')
          .update({
            last_message: textToSend.length > 50 ? textToSend.substring(0, 47) + '...' : textToSend,
            last_message_at: new Date().toISOString(),
          })
          .eq('id', chatId);
          
      } catch (roomError) {
        console.warn('방 정보 업데이트 실패 (무시):', roomError);
      }

    } catch (err: any) {
      console.error('메시지 전송 실패:', err);
      toast.error('메시지 전송에 실패했습니다.');
      setInputText(textToSend); // 실패 시 복구
    }
  };

  const handleAddFriend = async () => {
    if (!chatId || !user) return;

    const friendId = chatId.split('_').find(id => id !== user.id);
    if (!friendId) return;

    try {
      await supabase
        .from('friends')
        .upsert({
          user_id: user.id,
          friend_user_id: friendId,
          name: roomTitle,
          friendly_score: 50,
          is_blocked: false
        });

      setIsFriend(true);
      setIsBlocked(false);
      toast.success('친구로 추가되었습니다.');
      fetchInitialData();
    } catch (err) {
      console.error('친구 추가 실패:', err);
      toast.error('친구 추가에 실패했습니다.');
    }
  };

  // [추가] 사용자 차단 기능
  const handleBlockUser = async () => {
    if (!chatId || !user) return;

    const friendId = chatId.split('_').find(id => id !== user.id);
    if (!friendId) return;

    if (!window.confirm('차단하시겠습니까? 차단하면 메시지를 받을 수 없습니다.')) return;

    try {
      await supabase
        .from('friends')
        .upsert({
          user_id: user.id,
          friend_user_id: friendId,
          name: roomTitle,
          is_blocked: true
        });

      setIsBlocked(true);
      toast.success('사용자가 차단되었습니다.');
      // 차단 후 추가 조치(예: 목록으로 이동)가 필요하면 여기에 추가
    } catch (err) {
      console.error('차단 실패:', err);
      toast.error('차단에 실패했습니다.');
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase();
    return messages
      .filter(m => m.content.toLowerCase().includes(lowerQuery))
      .map(m => m.id);
  }, [searchQuery, messages]);

  const handleSearchMove = (direction: 'up' | 'down') => {
    if (searchResults.length === 0) return;

    let nextIndex = currentSearchIndex + (direction === 'up' ? -1 : 1);

    if (nextIndex < 0) nextIndex = searchResults.length - 1;
    if (nextIndex >= searchResults.length) nextIndex = 0;

    setCurrentSearchIndex(nextIndex);

    const targetId = searchResults[nextIndex];
    messageRefs.current[targetId]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#1C1C1E] text-white overflow-hidden relative">
      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-30">
        <div className="flex items-center">
          <button onClick={() => navigate('/main/chats')} className="p-2">
            <ChevronLeft className="w-7 h-7" />
          </button>
          <h1 className="text-base font-bold ml-1">{roomTitle}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsSearching(!isSearching)} className="p-2 text-white">
            <Search className="w-6 h-6" />
          </button>
          <button onClick={() => navigate(`/chat/room/${chatId}/settings`)} className="p-2 text-white">
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="bg-[#2C2C2E] px-4 py-2 border-b border-[#3A3A3C] flex items-center gap-2 overflow-hidden"
          >
            <input
              autoFocus
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value);
                setCurrentSearchIndex(-1);
              }}
              placeholder="대화 내용 검색"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            <div className="flex items-center gap-1">
              <button onClick={() => handleSearchMove('up')} className="p-1">
                <ChevronUp className="w-4 h-4" />
              </button>
              <button onClick={() => handleSearchMove('down')} className="p-1">
                <ChevronDown className="w-4 h-4" />
              </button>
              <button onClick={() => setIsSearching(false)} className="ml-1 text-xs text-[#8E8E93]">
                취소
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* [수정됨] 미등록 사용자 안내 (친구 추가 / 차단 버튼) */}
      {!isLoading && !isGroupChat && !isFriend && !isBlocked && (
        <div className="bg-[#2C2C2E] p-4 flex items-center justify-between border-b border-[#3A3A3C] z-20">
          <div className="flex items-center">
            <ShieldAlert className="w-6 h-6 text-brand-DEFAULT" />
            <div className="ml-3">
              <p className="text-sm font-bold">미등록 사용자</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleBlockUser} 
              className="bg-[#3A3A3C] px-3 py-2 rounded-xl text-xs font-medium text-white border border-white/10"
            >
              차단
            </button>
            <button 
              onClick={handleAddFriend} 
              className="bg-brand-DEFAULT px-3 py-2 rounded-xl text-xs font-bold text-white"
            >
              친구 추가
            </button>
          </div>
        </div>
      )}

      {/* 차단된 사용자 안내 */}
      {!isLoading && !isGroupChat && isBlocked && (
        <div className="bg-[#2C2C2E] p-4 flex items-center justify-between border-b border-[#3A3A3C] z-20">
          <div className="flex items-center">
            <Ban className="w-6 h-6 text-[#EC5022]" />
            <div className="ml-3">
              <p className="text-sm font-bold text-[#EC5022]">차단된 사용자</p>
            </div>
          </div>
          <button 
            onClick={handleAddFriend} // 친구 추가 시 차단 해제됨
            className="bg-[#3A3A3C] px-4 py-2 rounded-xl text-xs font-bold text-white border border-white/10"
          >
            차단 해제
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isLoading ? (
          <div className="text-center mt-10 text-[#8E8E93]">로딩 중...</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#8E8E93]">
            <p>아직 메시지가 없습니다</p>
            <p className="text-sm mt-2">대화를 시작해보세요!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === user?.id;
            const sender = memberProfiles[msg.sender_id];

            return (
              <div
                key={msg.id}
                ref={el => { messageRefs.current[msg.id] = el; }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <div className="w-9 h-9 rounded-[14px] bg-[#3A3A3C] mr-2 overflow-hidden border border-white/5 flex-shrink-0">
                    {sender?.avatar ? (
                      <img src={sender.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <UserIcon className="w-5 h-5 m-auto mt-2 text-[#8E8E93] opacity-30" />
                    )}
                  </div>
                )}

                <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {/* 그룹 채팅일 때만 발신자 이름 표시 */}
                  {!isMe && isGroupChat && (
                    <span className="text-xs text-[#8E8E93] mb-1 ml-1">
                      {sender?.name || '알수없음'}
                    </span>
                  )}

                  <div
                    className={`p-3 rounded-2xl text-[15px] leading-relaxed ${
                      isMe
                        ? 'bg-brand-DEFAULT rounded-tr-none'
                        : 'bg-[#2C2C2E] rounded-tl-none border border-white/5'
                    }`}
                  >
                    {msg.content}
                  </div>

                  <span className="text-[10px] text-[#636366] mt-1">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      <div className="p-3 bg-[#1C1C1E] border-t border-[#2C2C2E] flex items-center gap-3">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 bg-[#2C2C2E] rounded-full transition-transform active:scale-90"
        >
          <Plus className={isMenuOpen ? 'rotate-45' : ''} />
        </button>

        <textarea
          ref={inputRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="메시지 입력..."
          className="flex-1 bg-[#2C2C2E] rounded-2xl p-3 px-4 text-[15px] focus:outline-none resize-none max-h-32"
          rows={1}
        />

        <button
          onClick={handleSendMessage}
          disabled={!inputText.trim()}
          className={`p-3 rounded-full transition-all ${
            inputText.trim() ? 'bg-brand-DEFAULT' : 'bg-[#2C2C2E] text-[#636366]'
          }`}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {/* 사용하지 않는 아이콘 숨김 처리 */}
      <div className="hidden">
        <AtSign /><X /><Ban /><Unlock /><ExternalLink /><FileText />
        <ImageIcon /><Camera /><Download /><UserPlus /><Smile />
      </div>
    </div>
  );
}