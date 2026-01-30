import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Send, MoreHorizontal, ShieldAlert, 
  Search, ChevronUp, ChevronDown, Plus, ImageIcon, 
  Camera, FileText, Smile, X, Download, ChevronRight,
  User as UserIcon, Ban, Sparkles, Rocket
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

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

// 파일 타입 판별
const getFileType = (content: string) => {
  const isStorageFile = content.includes('chat-uploads');
  if (isStorageFile) {
    const ext = content.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
    if (['mp4', 'mov', 'webm', 'avi', 'm4v'].includes(ext || '')) return 'video';
    if (['pdf'].includes(ext || '')) return 'pdf';
    if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp'].includes(ext || '')) return 'office';
    if (['txt', 'log', 'md', 'json'].includes(ext || '')) return 'text-file';
    return 'file';
  }
  return 'text';
};

// 파일명 추출
const getFileName = (url: string) => {
  try {
    const decodedUrl = decodeURIComponent(url);
    const rawName = decodedUrl.split('/').pop() || 'file';
    if (rawName.includes('___')) return rawName.split('___')[1];
    return rawName.replace(/^\d+_/, '');
  } catch {
    return '첨부파일';
  }
};

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
  const [showEmojiModal, setShowEmojiModal] = useState(false);
  
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<{[key: number]: HTMLDivElement | null}>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const isGroupChat = chatId?.startsWith('group_') ?? false;

  // 이미지 목록
  const allImages = useMemo(() => {
    return messages.filter(m => getFileType(m.content) === 'image').map(m => m.content);
  }, [messages]);

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
      const { data: room, error: roomError } = await supabase
        .from('chat_rooms')
        .select('id, type, title, created_by, members_count')
        .eq('id', chatId)
        .maybeSingle();

      if (roomError) throw roomError;

      let memberIds: string[] = [];

      if (room) {
        const { data: members, error: membersError } = await supabase
          .from('room_members')
          .select('user_id')
          .eq('room_id', chatId);

        if (membersError) throw membersError;
        memberIds = members?.map(m => m.user_id) || [];
      } else {
        if (!isGroupChat) {
          const ids = chatId.split('_');
          memberIds = ids.filter(id => id.length > 0);
        }
      }

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
    setInputText('');

    try {
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

      if (inserted) {
        setMessages(prev => [...prev, inserted]);
      }

      setTimeout(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

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
      setInputText(textToSend);
    }
  };

  // 파일 업로드 핸들러
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;

    const uploadToast = toast.loading('파일 전송 중...');
    setIsMenuOpen(false);

    try {
      const fileName = `${Date.now()}___${file.name.replace(/[^a-zA-Z0-9가-힣.]/g, '_')}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-uploads')
        .upload(`${chatId}/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-uploads')
        .getPublicUrl(`${chatId}/${fileName}`);

      await supabase.from('chat_rooms').update({
        last_message: '파일을 보냈습니다.',
        last_message_at: new Date().toISOString()
      }).eq('id', chatId);

      const { data: newMsg } = await supabase.from('messages').insert({
        room_id: chatId,
        sender_id: user.id,
        content: publicUrl,
        is_read: false
      }).select().single();

      if (newMsg) setMessages(prev => [...prev, newMsg]);

      toast.success('전송 완료', { id: uploadToast });
    } catch (error) {
      console.error('Upload Error:', error);
      toast.error('전송 실패', { id: uploadToast });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
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

  // 메시지 렌더링
  const renderMessageContent = (msg: Message, isMe: boolean) => {
    const type = getFileType(msg.content);

    if (type === 'image') {
      return (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-[#3A3A3C] max-w-[240px] cursor-pointer">
          <img 
            src={msg.content} 
            alt="" 
            className="w-full h-auto object-cover" 
            onClick={() => {
              setInitialImageIndex(allImages.indexOf(msg.content));
              setIsViewerOpen(true);
            }}
          />
        </div>
      );
    }

    if (type === 'video') {
      return (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-[#3A3A3C] max-w-[280px] bg-black">
          <video src={msg.content} controls playsInline className="w-full h-auto max-h-[300px]" />
        </div>
      );
    }

    if (['pdf', 'file', 'office', 'text-file'].includes(type)) {
      return (
        <div className="flex items-center gap-0 p-1.5 rounded-2xl max-w-[280px] bg-[#2C2C2E] border border-[#3A3A3C]">
          <div 
            onClick={() => window.open(msg.content, '_blank')} 
            className="flex-1 flex items-center gap-3 p-2 cursor-pointer hover:bg-white/5 rounded-xl transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-[#3A3A3C] flex items-center justify-center shrink-0 border border-white/5">
              <FileText className="w-5 h-5 text-[#EC5022]" />
            </div>
            <div className="flex-1 min-w-0 mr-1">
              <p className="text-[14px] text-white truncate font-medium">{getFileName(msg.content)}</p>
              <p className="text-[10px] text-[#8E8E93] uppercase tracking-wide">{type.replace('-file','').toUpperCase()}</p>
            </div>
          </div>
          <div className="h-8 w-[1px] bg-white/10 mx-1" />
          <button 
            onClick={() => {
              const a = document.createElement('a');
              a.href = msg.content;
              a.download = getFileName(msg.content);
              a.click();
            }} 
            className="p-3 text-[#8E8E93] hover:text-brand-DEFAULT transition-all"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      );
    }

    return (
      <div className={`px-4 py-2.5 text-[15px] leading-relaxed break-words shadow-sm ${
        isMe
          ? 'bg-brand-DEFAULT text-white rounded-[20px] rounded-tr-none'
          : 'bg-[#2C2C2E] text-white rounded-[20px] rounded-tl-none border border-[#3A3A3C]'
      }`}>
        {msg.content}
      </div>
    );
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

      {!isLoading && !isGroupChat && isBlocked && (
        <div className="bg-[#2C2C2E] p-4 flex items-center justify-between border-b border-[#3A3A3C] z-20">
          <div className="flex items-center">
            <Ban className="w-6 h-6 text-[#EC5022]" />
            <div className="ml-3">
              <p className="text-sm font-bold text-[#EC5022]">차단된 사용자</p>
            </div>
          </div>
          <button 
            onClick={handleAddFriend}
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
                  {!isMe && isGroupChat && (
                    <span className="text-xs text-[#8E8E93] mb-1 ml-1">
                      {sender?.name || '알수없음'}
                    </span>
                  )}

                  {renderMessageContent(msg, isMe)}

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

      {/* 입력 영역 */}
      <div className="p-3 bg-[#1C1C1E] border-t border-[#2C2C2E] flex items-center gap-3 relative">
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2 bg-[#2C2C2E] rounded-full transition-transform active:scale-90"
        >
          <Plus className={`w-5 h-5 transition-transform ${isMenuOpen ? 'rotate-45' : ''}`} />
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

        {/* 플러스 버튼 메뉴 */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-20 left-3 bg-[#2C2C2E] rounded-2xl p-3 border border-[#3A3A3C] shadow-2xl"
            >
              <div className="grid grid-cols-4 gap-3">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setIsMenuOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#3A3A3C] transition-colors"
                >
                  <div className="w-12 h-12 bg-[#3A3A3C] rounded-full flex items-center justify-center">
                    <ImageIcon className="w-6 h-6 text-brand-DEFAULT" />
                  </div>
                  <span className="text-xs text-white">앨범</span>
                </button>

                <button
                  onClick={() => {
                    cameraInputRef.current?.click();
                    setIsMenuOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#3A3A3C] transition-colors"
                >
                  <div className="w-12 h-12 bg-[#3A3A3C] rounded-full flex items-center justify-center">
                    <Camera className="w-6 h-6 text-brand-DEFAULT" />
                  </div>
                  <span className="text-xs text-white">카메라</span>
                </button>

                <button
                  onClick={() => {
                    docInputRef.current?.click();
                    setIsMenuOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#3A3A3C] transition-colors"
                >
                  <div className="w-12 h-12 bg-[#3A3A3C] rounded-full flex items-center justify-center">
                    <FileText className="w-6 h-6 text-brand-DEFAULT" />
                  </div>
                  <span className="text-xs text-white">파일</span>
                </button>

                <button
                  onClick={() => {
                    setShowEmojiModal(true);
                    setIsMenuOpen(false);
                  }}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-[#3A3A3C] transition-colors"
                >
                  <div className="w-12 h-12 bg-[#3A3A3C] rounded-full flex items-center justify-center">
                    <Smile className="w-6 h-6 text-brand-DEFAULT" />
                  </div>
                  <span className="text-xs text-white">이모티콘</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Hidden file inputs */}
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" ref={docInputRef} onChange={handleFileUpload} className="hidden" />

      {/* 이모티콘 준비중 모달 */}
      <AnimatePresence>
        {showEmojiModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setShowEmojiModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-[320px] bg-[#1C1C1E] border border-white/10 rounded-3xl p-8 overflow-hidden shadow-2xl text-center"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-brand-DEFAULT/20 blur-[60px] rounded-full pointer-events-none" />

              <button 
                onClick={() => setShowEmojiModal(false)}
                className="absolute top-4 right-4 text-[#8E8E93] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative mb-6 flex justify-center">
                <div className="w-20 h-20 bg-gradient-to-br from-[#3A3A3C] to-[#2C2C2E] rounded-full flex items-center justify-center shadow-inner border border-white/5 relative z-10">
                  <Rocket className="w-10 h-10 text-brand-DEFAULT fill-brand-DEFAULT/20 -ml-1 -mt-1" />
                </div>
                
                <motion.div 
                  className="absolute -top-3 -right-2 z-20"
                  animate={{ 
                    y: [0, -8, 0],       
                    rotate: [0, 20, -10], 
                    scale: [1, 1.2, 1], 
                    opacity: [0.8, 1, 0.8]
                  }}
                  transition={{ 
                    duration: 3.5, 
                    ease: "easeInOut", 
                    repeat: Infinity,
                    repeatType: "mirror"
                  }}
                >
                  <Sparkles className="w-7 h-7 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                </motion.div>
              </div>

              <h3 className="text-xl font-bold text-white mb-3">이모티콘 기능</h3>
              <div className="text-[13px] text-[#8E8E93] leading-relaxed space-y-1 mb-8">
                <p>해당 기능은 현재 그레인이</p>
                <p>더 풍성한 앱이 되기 위해 <span className="text-brand-DEFAULT font-semibold">준비중</span>입니다.</p>
                <p className="pt-2">잠시만 기다려주시면 곧 오픈하겠습니다!</p>
              </div>

              <button 
                onClick={() => setShowEmojiModal(false)}
                className="w-full py-3.5 bg-brand-DEFAULT rounded-xl text-white font-bold text-sm hover:bg-brand-hover transition-colors shadow-lg shadow-brand-DEFAULT/20"
              >
                기대해주세요!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 이미지 뷰어 */}
      <ImageViewerModal 
        isOpen={isViewerOpen} 
        initialIndex={initialImageIndex} 
        images={allImages} 
        onClose={() => setIsViewerOpen(false)} 
      />
    </div>
  );
}

function ImageViewerModal({ isOpen, initialIndex, images, onClose }: { 
  isOpen: boolean; 
  initialIndex: number; 
  images: string[]; 
  onClose: () => void; 
}) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);

  useEffect(() => { 
    if (isOpen) setIndex(initialIndex); 
  }, [isOpen, initialIndex]);

  const paginate = (d: number) => { 
    const n = index + d; 
    if (n >= 0 && n < images.length) { 
      setDirection(d); 
      setIndex(n); 
    } 
  };

  const handleDragEnd = (_: any, info: any) => { 
    if (info.offset.x < -50 && index < images.length - 1) paginate(1); 
    else if (info.offset.x > 50 && index > 0) paginate(-1); 
  };

  if (!isOpen || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-center overflow-hidden bg-black/98 backdrop-blur-2xl">
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between z-20">
        <span className="text-white/80 font-mono text-sm bg-black/40 px-3 py-1 rounded-full">
          {index + 1} / {images.length}
        </span>
        <button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      {index > 0 && (
        <button 
          onClick={() => paginate(-1)} 
          className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full z-20 hidden md:block transition-all"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      
      {index < images.length - 1 && (
        <button 
          onClick={() => paginate(1)} 
          className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full z-20 hidden md:block transition-all"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
      
      <div className="flex-1 flex items-center justify-center relative w-full h-full">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img 
            key={index} 
            src={images[index]} 
            custom={direction} 
            variants={{
              enter: (d: number) => ({ x: d > 0 ? 600 : -600, opacity: 0, scale: 0.9 }),
              center: { x: 0, opacity: 1, scale: 1 },
              exit: (d: number) => ({ x: d < 0 ? 600 : -600, opacity: 0, scale: 0.9 })
            }}
            initial="enter" 
            animate="center" 
            exit="exit" 
            transition={{ type: "spring", stiffness: 350, damping: 35 }}
            drag="x" 
            dragConstraints={{ left: 0, right: 0 }} 
            dragElastic={0.7} 
            onDragEnd={handleDragEnd}
            className="absolute max-w-full max-h-full object-contain touch-none cursor-grab active:cursor-grabbing" 
            alt="" 
          />
        </AnimatePresence>
      </div>
    </div>
  );
}