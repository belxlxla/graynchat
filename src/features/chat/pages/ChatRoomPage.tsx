import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Send, Plus, MoreHorizontal, Image as ImageIcon, Smile, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext'; // ✨ Auth Hook 추가

// --- [Types] ---
interface Message {
  id: number;
  room_id: number;
  sender_id: string; 
  content: string;
  created_at: string;
  is_read: boolean;
}

export default function ChatRoomPage() {
  const { chatId } = useParams(); 
  const navigate = useNavigate();
  const { user } = useAuth(); // ✨ 현재 로그인한 유저 정보 가져오기
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [roomTitle, setRoomTitle] = useState('채팅방');
  const [isLoading, setIsLoading] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatId) return;

    const fetchInitialData = async () => {
      try {
        const { data: roomData } = await supabase
          .from('chat_rooms')
          .select('title')
          .eq('id', chatId)
          .single();
        
        if (roomData) setRoomTitle(roomData.title);

        const { data: msgData, error } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', chatId)
          .order('created_at', { ascending: true }); 

        if (error) throw error;
        setMessages(msgData || []);
      } catch (error) {
        console.error('Error loading chat:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();

    const channel = supabase
      .channel(`room:${chatId}`) 
      .on(
        'postgres_changes',
        {
          event: 'INSERT', 
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${chatId}`, 
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatId || !user) return; // ✨ user 체크 추가

    const textToSend = inputText;
    setInputText(''); 

    try {
      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          room_id: Number(chatId),
          sender_id: user.id, // ✨ 진짜 내 ID 사용 ('me' 아님)
          content: textToSend,
          is_read: false
        });

      if (msgError) throw msgError;

      await supabase
        .from('chat_rooms')
        .update({ 
          last_message: textToSend,
          updated_at: new Date().toISOString() 
        })
        .eq('id', chatId);

    } catch (error) {
      console.error('Send Error:', error);
      toast.error('메시지 전송 실패');
      setInputText(textToSend); 
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#1C1C1E] text-white">
      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E]/95 backdrop-blur-md border-b border-[#2C2C2E] shrink-0 z-20 sticky top-0">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
            <ChevronLeft className="w-7 h-7" />
          </button>
          <div className="ml-1">
            <h1 className="text-base font-bold leading-tight">{roomTitle}</h1>
            <span className="text-[11px] text-[#8E8E93]">현재 활동 중</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
            <Search className="w-6 h-6" />
          </button>
          <button 
            onClick={() => navigate(`/chat/room/${chatId}/settings`)}
            className="p-2 text-white hover:text-brand-DEFAULT transition-colors"
          >
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center items-center h-full text-[#8E8E93] text-sm">
            대화 내용을 불러오는 중...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col justify-center items-center h-full text-[#8E8E93] opacity-50 gap-2">
            <div className="w-16 h-16 bg-[#2C2C2E] rounded-full flex items-center justify-center">
              <Smile className="w-8 h-8" />
            </div>
            <p className="text-sm">대화를 시작해보세요!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.sender_id === user?.id; // ✨ 내 ID와 비교
            const showProfile = !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);

            return (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                {!isMe && (
                  <div className={`w-8 h-8 rounded-xl bg-[#3A3A3C] mr-2 shrink-0 overflow-hidden ${!showProfile ? 'invisible' : ''}`}>
                    <img src={`https://i.pravatar.cc/150?u=${msg.sender_id}`} className="w-full h-full object-cover" />
                  </div>
                )}
                
                <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && showProfile && (
                    <span className="text-[11px] text-[#8E8E93] mb-1 ml-1">상대방</span>
                  )}
                  <div 
                    className={`px-4 py-2.5 text-[15px] leading-relaxed break-words shadow-sm ${
                      isMe 
                        ? 'bg-brand-DEFAULT text-white rounded-[20px] rounded-tr-none' 
                        : 'bg-[#2C2C2E] text-white rounded-[20px] rounded-tl-none border border-[#3A3A3C]'
                    }`}
                  >
                    {msg.content}
                  </div>
                  <span className="text-[10px] text-[#636366] mt-1 px-1">
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      <div className="shrink-0 bg-[#1C1C1E] border-t border-[#2C2C2E] p-3 pb-safe">
        <div className="flex items-end gap-2">
          <button className="p-2.5 text-[#8E8E93] hover:text-white bg-[#2C2C2E] rounded-full transition-colors shrink-0">
            <Plus className="w-5 h-5" />
          </button>
          
          <div className="flex-1 bg-[#2C2C2E] rounded-[24px] min-h-[44px] flex items-center px-4 py-2 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="메시지 보내기"
              className="w-full bg-transparent text-white text-[15px] placeholder-[#636366] focus:outline-none resize-none max-h-[100px] py-1 custom-scrollbar"
              rows={1}
              style={{ height: 'auto', minHeight: '24px' }}
            />
          </div>

          <button 
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className={`p-2.5 rounded-full shrink-0 transition-all ${
              inputText.trim() 
                ? 'bg-brand-DEFAULT text-white shadow-lg shadow-brand-DEFAULT/20' 
                : 'bg-[#2C2C2E] text-[#636366]'
            }`}
          >
            <Send className="w-5 h-5 fill-current" />
          </button>
        </div>
      </div>

    </div>
  );
}