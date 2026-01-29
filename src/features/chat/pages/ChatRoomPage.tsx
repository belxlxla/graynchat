import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Send, Plus, MoreHorizontal, ImageIcon, Smile, Search, Camera, 
  FileText, X, Download, ChevronUp, ChevronDown, AtSign, User as UserIcon,
  UserPlus, Ban, Unlock, ShieldAlert, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

interface Message { id: number; room_id: string; sender_id: string; content: string; created_at: string; is_read: boolean; }
interface Friend { id: number; friend_user_id: string; name: string; avatar: string | null; }

export default function ChatRoomPage() {
  const { chatId } = useParams(); 
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomTitle, setRoomTitle] = useState('대화방'); 
  const [isLoading, setIsLoading] = useState(true);
  const [roomMembers, setRoomMembers] = useState<Friend[]>([]);
  const [isFriend, setIsFriend] = useState<boolean>(true);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const fetchInitialData = async () => {
    if (!chatId || !user) return;
    try {
      const friendUUID = chatId.split('_').find(id => id !== user.id);
      if (!friendUUID) return;

      const { data: friendRecord } = await supabase.from('friends').select('*').eq('user_id', user.id).eq('friend_user_id', friendUUID).maybeSingle();

      if (friendRecord) {
        setRoomTitle(friendRecord.name);
        setRoomMembers([{ id: friendRecord.id, friend_user_id: friendRecord.friend_user_id, name: friendRecord.name, avatar: friendRecord.avatar }]);
        setIsFriend(true);
        setIsBlocked(!!friendRecord.is_blocked);
      } else {
        setIsFriend(false);
        const { data: userData } = await supabase.from('users').select('name').eq('id', friendUUID).maybeSingle();
        setRoomTitle(userData?.name || '알 수 없는 사용자');
      }

      const { data: msgData } = await supabase.from('messages').select('*').eq('room_id', chatId).order('created_at', { ascending: true }); 
      setMessages(msgData || []);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  // ✨ 실시간 구독: RLS가 true로 설정되어 있다면 무료 플랜에서도 즉시 작동
  useEffect(() => {
    fetchInitialData();
    if (!chatId) return;

    const channel = supabase.channel(`room_${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${chatId}` }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
      }).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, user?.id]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatId || !user || isBlocked) return;
    const textToSend = inputText;
    setInputText('');
    try {
      // 1. 내 목록 업데이트
      await supabase.from('chat_rooms').upsert({ id: chatId, user_id: user.id, title: roomTitle, last_message: textToSend, updated_at: new Date().toISOString() }, { onConflict: 'id' });
      
      // 2. 메시지 전송 (상대방 채널로 방송됨)
      const { data: newMsg, error } = await supabase.from('messages').insert({ room_id: chatId, sender_id: user.id, content: textToSend, is_read: false }).select().single();
      if (error) throw error;
      if (newMsg) setMessages(prev => [...prev, newMsg]);
    } catch (e) { toast.error('전송 실패'); setInputText(textToSend); }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#1C1C1E] text-white overflow-hidden relative">
      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-30">
        <button onClick={() => navigate('/main/chats')} className="p-2 text-white"><ChevronLeft className="w-7 h-7" /></button>
        <h1 className="text-base font-bold">{roomTitle}</h1>
        <button onClick={() => navigate(`/chat/room/${chatId}/settings`)} className="p-2 text-white"><MoreHorizontal className="w-6 h-6" /></button>
      </header>

      {/* 친구 미등록/차단 안내 바 */}
      {!isLoading && (!isFriend || isBlocked) && (
        <div className="bg-[#2C2C2E] p-4 flex items-center justify-between border-b border-[#3A3A3C] z-20">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-6 h-6 text-brand-DEFAULT" />
            <div><p className="text-sm font-bold">{isBlocked ? '차단된 사용자' : '미등록 사용자'}</p><p className="text-[11px] text-[#8E8E93]">친구 추가 후 대화가 가능합니다.</p></div>
          </div>
          <button onClick={handleAddFriend} className="bg-brand-DEFAULT px-4 py-2 rounded-xl text-xs font-bold">친구 추가</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? <div className="text-center mt-10 text-[#8E8E93]">로딩 중...</div> : 
         messages.map((msg, i) => {
           const isMe = msg.sender_id === user?.id;
           return (
             <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
               {!isMe && <div className="w-8 h-8 rounded-xl bg-[#3A3A3C] mr-2 overflow-hidden"><img src={roomMembers[0]?.avatar || `https://i.pravatar.cc/150?u=${msg.sender_id}`} alt="" /></div>}
               <div className={`max-w-[70%] p-3 rounded-2xl ${isMe ? 'bg-brand-DEFAULT rounded-tr-none' : 'bg-[#2C2C2E] rounded-tl-none'}`}>{msg.content}</div>
             </div>
           );
         })}
        <div ref={scrollRef} />
      </div>

      <div className="p-3 bg-[#1C1C1E] border-t border-[#2C2C2E] flex items-center gap-3">
        <textarea ref={inputRef} value={inputText} onChange={e => setInputText(e.target.value)} disabled={isBlocked} placeholder="메시지 입력" className="flex-1 bg-[#2C2C2E] rounded-2xl p-3 text-sm focus:outline-none resize-none" rows={1} />
        <button onClick={handleSendMessage} className="p-3 bg-brand-DEFAULT rounded-full"><Send className="w-5 h-5" /></button>
      </div>
    </div>
  );
}