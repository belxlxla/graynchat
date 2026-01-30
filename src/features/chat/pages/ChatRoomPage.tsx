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

// --- [Utils] ---
const getFileType = (content: string) => {
  if (!content) return 'text';
  const isStorageFile = content.includes('chat-uploads');
  if (isStorageFile) {
    const ext = content.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
    return 'file';
  }
  return 'text';
};

const getFileName = (url: string) => {
  try {
    const decodedUrl = decodeURIComponent(url);
    const rawName = decodedUrl.split('/').pop() || 'file';
    return rawName.includes('___') ? rawName.split('___')[1] : rawName.replace(/^\d+_/, '');
  } catch { return '첨부파일'; }
};

export default function ChatRoomPage() {
  const { chatId } = useParams(); 
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

  const fetchInitialData = useCallback(async () => {
    if (!chatId || !user) return;
    try {
      const ids = chatId.split('_');
      const friendUUID = ids.find(id => id !== user.id && id.length > 20);
      
      if (!friendUUID) {
        setIsLoading(false);
        return;
      }

      const { data: profiles } = await supabase
        .from('users')
        .select('id, name, avatar')
        .in('id', [user.id, friendUUID]);

      const profileMap: Record<string, MemberProfile> = {};
      if (profiles) {
        profiles.forEach(p => { profileMap[p.id] = p; });
        setMemberProfiles(profileMap);
      }

      const { data: friendRecord } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', user.id)
        .eq('friend_user_id', friendUUID)
        .maybeSingle();

      if (friendRecord) {
        const realName = profiles?.find(p => p.id === friendUUID)?.name;
        setRoomTitle(realName || friendRecord.name);
        setIsFriend(true);
        setIsBlocked(!!friendRecord.is_blocked);
      } else {
        setIsFriend(false);
        const foundFriend = profiles?.find(p => p.id === friendUUID);
        setRoomTitle(foundFriend?.name || '알 수 없는 사용자');
      }

      const { data: msgData } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', chatId)
        .order('created_at', { ascending: true }); 
      
      setMessages(msgData || []);
    } catch (e) {
      console.error("Data Load Error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, user]);

  // ✅ 실시간 메시지 구독 강화
  useEffect(() => {
    fetchInitialData();
    if (!chatId) return;

    const channel = supabase.channel(`room_${chatId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages', 
        filter: `room_id=eq.${chatId}` 
      }, (payload) => {
        console.log('📨 New Message:', payload);
        const newMsg = payload.new as Message;
        setMessages(prev => {
          // 중복 방지
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, fetchInitialData]);

  useEffect(() => {
    if (scrollRef.current && !isSearching) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSearching]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatId || !user || isBlocked) return;
    const textToSend = inputText;
    setInputText('');
    
    try {
      // ✅ 트리거가 자동으로 처리하므로 별도 chat_rooms 업데이트 불필요
      const { data: newMsg, error } = await supabase.from('messages').insert({ 
        room_id: chatId, 
        sender_id: user.id, 
        content: textToSend, 
        is_read: false 
      }).select().single();
      
      if (error) throw error;
      
      // ✅ 로컬 상태에도 즉시 반영 (실시간 구독 전까지 딜레이 방지)
      if (newMsg && !messages.some(m => m.id === newMsg.id)) {
        setMessages(prev => [...prev, newMsg]);
      }
    } catch (e) {
      console.error('Send Error:', e);
      toast.error('전송 실패');
      setInputText(textToSend);
    }
  };

  const handleAddFriend = async () => {
    const friendUUID = chatId?.split('_').find(id => id !== user?.id);
    if (!friendUUID || !user) return;
    try {
      await supabase.from('friends').upsert({ user_id: user.id, friend_user_id: friendUUID, name: roomTitle, friendly_score: 50 });
      setIsFriend(true);
      toast.success('친구로 추가되었습니다.');
      fetchInitialData();
    } catch { toast.error('추가 실패'); }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase())).map(m => m.id);
  }, [searchQuery, messages]);

  const handleSearchMove = (direction: 'up' | 'down') => {
    if (searchResults.length === 0) return;
    let nextIndex = direction === 'up' ? currentSearchIndex - 1 : currentSearchIndex + 1;
    if (nextIndex < 0) nextIndex = searchResults.length - 1;
    if (nextIndex >= searchResults.length) nextIndex = 0;
    setCurrentSearchIndex(nextIndex);
    const targetId = searchResults[nextIndex];
    messageRefs.current[targetId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#1C1C1E] text-white overflow-hidden relative">
      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-30">
        <div className="flex items-center">
          <button onClick={() => navigate('/main/chats')} className="p-2"><ChevronLeft className="w-7 h-7" /></button>
          <h1 className="text-base font-bold ml-1">{roomTitle}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsSearching(!isSearching)} className="p-2 text-white"><Search className="w-6 h-6" /></button>
          <button onClick={() => navigate(`/chat/room/${chatId}/settings`)} className="p-2 text-white"><MoreHorizontal className="w-6 h-6" /></button>
        </div>
      </header>

      <AnimatePresence>
        {isSearching && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="bg-[#2C2C2E] px-4 py-2 border-b border-[#3A3A3C] flex items-center gap-2 overflow-hidden">
            <input autoFocus value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentSearchIndex(-1); }} placeholder="대화 내용 검색" className="flex-1 bg-transparent text-sm focus:outline-none" />
            <div className="flex items-center gap-1">
              <button onClick={() => handleSearchMove('up')} className="p-1"><ChevronUp className="w-4 h-4" /></button>
              <button onClick={() => handleSearchMove('down')} className="p-1"><ChevronDown className="w-4 h-4" /></button>
              <button onClick={() => setIsSearching(false)} className="ml-1 text-xs text-[#8E8E93]">취소</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isLoading && (!isFriend || isBlocked) && (
        <div className="bg-[#2C2C2E] p-4 flex items-center justify-between border-b border-[#3A3A3C] z-20">
          <ShieldAlert className="w-6 h-6 text-brand-DEFAULT" />
          <div className="flex-1 ml-3"><p className="text-sm font-bold">미등록 사용자</p></div>
          <button onClick={handleAddFriend} className="bg-brand-DEFAULT px-4 py-2 rounded-xl text-xs font-bold">친구 추가</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {isLoading ? <div className="text-center mt-10 text-[#8E8E93]">로딩 중...</div> : 
         messages.map((msg) => {
           const isMe = msg.sender_id === user?.id;
           const sender = memberProfiles[msg.sender_id];
           return (
             <div key={msg.id} ref={(el) => { messageRefs.current[msg.id] = el; }} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
               {!isMe && <div className="w-9 h-9 rounded-[14px] bg-[#3A3A3C] mr-2 overflow-hidden border border-white/5">
                 {sender?.avatar ? <img src={sender.avatar} className="w-full h-full object-cover" alt="" /> : <UserIcon className="w-5 h-5 m-auto mt-2 text-[#8E8E93] opacity-30" />}
               </div>}
               <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                 <div className={`p-3 rounded-2xl text-[15px] ${isMe ? 'bg-brand-DEFAULT rounded-tr-none' : 'bg-[#2C2C2E] rounded-tl-none border border-white/5'}`}>{msg.content}</div>
                 <span className="text-[10px] text-[#636366] mt-1">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
               </div>
             </div>
           );
         })}
        <div ref={scrollRef} />
      </div>

      <div className="p-3 bg-[#1C1C1E] border-t border-[#2C2C2E] flex items-center gap-3">
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="p-2 bg-[#2C2C2E] rounded-full transition-transform active:scale-90"><Plus className={isMenuOpen ? 'rotate-45' : ''} /></button>
        <textarea ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }}} placeholder="메시지 입력" className="flex-1 bg-[#2C2C2E] rounded-2xl p-2 px-4 text-[15px] focus:outline-none resize-none" rows={1} />
        <button onClick={handleSendMessage} disabled={!inputText.trim()} className={`p-3 rounded-full transition-all ${inputText.trim() ? 'bg-brand-DEFAULT' : 'bg-[#2C2C2E] text-[#636366]'}`}><Send className="w-5 h-5" /></button>
      </div>

      <div className="hidden"><AtSign /><X /><Ban /><Unlock /><ExternalLink /><FileText /><ImageIcon /><Camera /><Download /><UserPlus /><Smile /></div>
    </div>
  );
}