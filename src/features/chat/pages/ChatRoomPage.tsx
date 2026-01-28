import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Send, Plus, MoreHorizontal, 
  Image as ImageIcon, Smile, Search, Camera, 
  FileText, X, Download, ChevronRight, ChevronUp, ChevronDown, AtSign, User as UserIcon 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

// --- [Types] ---
interface Message {
  id: number;
  room_id: number;
  sender_id: string; 
  content: string;
  created_at: string;
  is_read: boolean;
}

interface Friend {
  id: number;
  name: string;
  avatar: string | null;
}

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
  const { chatId } = useParams(); 
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [roomTitle, setRoomTitle] = useState('로딩 중...'); 
  const [friendlyScore, setFriendlyScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roomMembers, setRoomMembers] = useState<Friend[]>([]);

  const [inputText, setInputText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);

  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionList, setShowMentionList] = useState(false);

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messageRefs = useRef<{[key: number]: HTMLDivElement | null}>({});

  const allImages = useMemo(() => {
    return messages.filter(m => getFileType(m.content) === 'image').map(m => m.content);
  }, [messages]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return messages
      .filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      .map(m => m.id);
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

  const filteredMentionFriends = useMemo(() => {
    let list = [...roomMembers];
    if (mentionSearch) {
      const searchLower = mentionSearch.toLowerCase();
      list = list.filter(f => f.name.toLowerCase().includes(searchLower));
    }
    const myInfo: Friend = { id: -1, name: '나', avatar: user?.user_metadata?.avatar_url || null };
    return [myInfo, ...list];
  }, [mentionSearch, roomMembers, user]);

  const handleMentionSelect = (name: string) => {
    if (name === '나') return;
    const lastAtIndex = inputText.lastIndexOf('@');
    const newText = inputText.substring(0, lastAtIndex) + `@${name} `;
    setInputText(newText);
    setShowMentionList(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (!chatId) return;
    const fetchInitialData = async () => {
      try {
        const parsedChatId = Number(chatId);
        const { data: friendData } = await supabase.from('friends').select('id, name, avatar, friendly_score').eq('id', isNaN(parsedChatId) ? -1 : parsedChatId).maybeSingle();
        if (friendData) {
          setRoomTitle(friendData.name);
          setFriendlyScore(friendData.friendly_score);
          setRoomMembers([{ id: friendData.id, name: friendData.name, avatar: friendData.avatar }]);
        } else {
          const { data: roomData } = await supabase.from('chat_rooms').select('title').eq('id', chatId).maybeSingle();
          setRoomTitle(roomData?.title || '그룹 채팅');
        }
        const { data: msgData, error: msgError } = await supabase.from('messages').select('*').eq('room_id', chatId).order('created_at', { ascending: true }); 
        if (msgError) throw msgError;
        setMessages(msgData || []);
        if (msgData && msgData.length > 0) {
          const senderIds = Array.from(new Set(msgData.map(m => Number(m.sender_id)).filter(id => Number.isFinite(id) && id !== Number(user?.id))));
          if (senderIds.length > 0) {
            const { data: members } = await supabase.from('friends').select('id, name, avatar').in('id', senderIds);
            if (members) setRoomMembers(prev => [...prev, ...members].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i));
          }
        }
      } catch (error) { console.error(error); } finally { setIsLoading(false); }
    };
    fetchInitialData();
    const channel = supabase.channel(`room:${chatId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${chatId}` }, (payload) => {
      const newMsg = payload.new as Message;
      setMessages((prev) => (prev.some(msg => msg.id === newMsg.id) ? prev : [...prev, newMsg]));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId, user?.id]);

  useEffect(() => {
    if (scrollRef.current && !isSearching) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isMenuOpen, isSearching]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputText(value);
    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1 && (lastAtIndex === 0 || value[lastAtIndex - 1] === ' ')) {
      const textAfterAt = value.substring(lastAtIndex + 1);
      if (!textAfterAt.includes(' ')) {
        setMentionSearch(textAfterAt);
        setShowMentionList(true);
        return;
      }
    }
    setShowMentionList(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatId || !user) return;
    const textToSend = inputText;
    setInputText('');
    setIsMenuOpen(false);
    setShowMentionList(false);
    try {
      await supabase.from('chat_rooms').upsert({ id: Number(chatId), title: roomTitle, last_message: textToSend, updated_at: new Date().toISOString() });
      const { data: newMsg } = await supabase.from('messages').insert({ room_id: Number(chatId), sender_id: user.id, content: textToSend, is_read: false }).select().single();
      if (newMsg) setMessages((prev) => [...prev, newMsg]);
    } catch (error) { toast.error('전송 실패'); setInputText(textToSend); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;
    const uploadToast = toast.loading('파일 전송 중...');
    try {
      const fileName = `${Date.now()}___${file.name.replace(/[^a-zA-Z0-9가-힣.]/g, '_')}`; 
      const { error: uploadError } = await supabase.storage.from('chat-uploads').upload(`${chatId}/${fileName}`, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat-uploads').getPublicUrl(`${chatId}/${fileName}`);
      await supabase.from('chat_rooms').upsert({ id: Number(chatId), title: roomTitle, last_message: '파일을 보냈습니다.', updated_at: new Date().toISOString() });
      const { data: newMsg } = await supabase.from('messages').insert({ room_id: Number(chatId), sender_id: user.id, content: publicUrl, is_read: false }).select().single();
      if (newMsg) setMessages((prev) => [...prev, newMsg]);
      toast.success('전송 완료', { id: uploadToast });
    } catch { toast.error('실패'); } finally { if (fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const renderMessageContent = (msg: Message, isMe: boolean) => {
    const type = getFileType(msg.content);
    if (type === 'image') return <div className="rounded-2xl overflow-hidden shadow-sm border border-[#3A3A3C] max-w-[240px]"><img src={msg.content} alt="" className="w-full h-auto object-cover" onClick={() => { setInitialImageIndex(allImages.indexOf(msg.content)); setIsViewerOpen(true); }} /></div>;
    if (type === 'video') return <div className="rounded-2xl overflow-hidden shadow-sm border border-[#3A3A3C] max-w-[280px] bg-black"><video src={msg.content} controls playsInline className="w-full h-auto max-h-[300px]" /></div>;
    if (['pdf', 'file', 'office', 'text-file'].includes(type)) {
      return (
        <div className="flex items-center gap-0 p-1.5 rounded-2xl max-w-[280px] bg-[#2C2C2E] border border-[#3A3A3C]">
          <div onClick={() => window.open(msg.content, '_blank')} className="flex-1 flex items-center gap-3 p-2 cursor-pointer hover:bg-white/5 rounded-xl transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#3A3A3C] flex items-center justify-center shrink-0 border border-white/5"><FileText className="w-5 h-5 text-[#EC5022]" /></div>
            <div className="flex-1 min-w-0 mr-1"><p className="text-[14px] text-white truncate font-medium">{getFileName(msg.content)}</p><p className="text-[10px] text-[#8E8E93] uppercase tracking-wide">{type.replace('-file','').toUpperCase()}</p></div>
          </div>
          <div className="h-8 w-[1px] bg-white/10 mx-1" /><button onClick={() => { const a = document.createElement('a'); a.href = msg.content; a.download = getFileName(msg.content); a.click(); }} className="p-3 text-[#8E8E93] hover:text-brand-DEFAULT transition-all"><Download className="w-5 h-5" /></button>
        </div>
      );
    }
    const mentionRegex = /(@[가-힣a-zA-Z0-9_]+)/g;
    const parts = msg.content.split(mentionRegex);
    return (
      <div className={`px-4 py-2.5 text-[15px] leading-relaxed break-words shadow-sm ${isMe ? 'bg-brand-DEFAULT text-white rounded-[20px] rounded-tr-none' : 'bg-[#2C2C2E] text-white rounded-[20px] rounded-tl-none border border-[#3A3A3C]'}`}>
        {parts.map((p, i) => {
          if (mentionRegex.test(p)) return <span key={i} className="font-bold text-blue-300 drop-shadow-sm">{p}</span>;
          if (searchQuery && p.toLowerCase().includes(searchQuery.toLowerCase())) {
            const searchRegex = new RegExp(`(${searchQuery})`, 'gi');
            const searchParts = p.split(searchRegex);
            return searchParts.map((sp, si) => searchRegex.test(sp) ? <mark key={si} className="bg-yellow-500 text-black rounded-sm">{sp}</mark> : sp);
          }
          return p;
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-[#1C1C1E] text-white overflow-hidden relative">
      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E]/95 backdrop-blur-md border-b border-[#2C2C2E] shrink-0 z-20 sticky top-0">
        <AnimatePresence mode="wait">
          {isSearching ? (
            <motion.div key="search" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="flex items-center w-full gap-2 px-2">
              <div className="flex-1 h-10 bg-[#2C2C2E] rounded-xl flex items-center px-3 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-all">
                <Search className="w-4 h-4 text-[#8E8E93] mr-2 shrink-0" />
                <input autoFocus value={searchQuery} onChange={(e) => {setSearchQuery(e.target.value); setCurrentSearchIndex(-1);}} placeholder="대화 내용 검색" className="w-full bg-transparent text-[15px] focus:outline-none" />
                {searchQuery && (
                  <div className="flex items-center gap-1 shrink-0 ml-1 border-l border-white/10 pl-2">
                    <span className="text-[11px] text-[#8E8E93] mr-1">{searchResults.length > 0 ? `${currentSearchIndex + 1}/${searchResults.length}` : '0'}</span>
                    <button onClick={() => handleSearchMove('up')} className="p-1 hover:text-brand-DEFAULT"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => handleSearchMove('down')} className="p-1 hover:text-brand-DEFAULT"><ChevronDown className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
              <button onClick={() => { setIsSearching(false); setSearchQuery(''); }} className="text-[15px] text-[#8E8E93] px-1 hover:text-white transition-colors">취소</button>
            </motion.div>
          ) : (
            <motion.div key="header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between w-full">
              <div className="flex items-center">
                {/* ✨ [수정] 뒤로가기 버튼 로직 강화: 명시적 경로 이동 */}
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate('/main/chats');
                  }} 
                  className="p-2 hover:text-brand-DEFAULT transition-colors active:opacity-50"
                >
                  <ChevronLeft className="w-7 h-7" />
                </button>
                <div className="ml-1 flex flex-col justify-center">
                  <h1 className="text-base font-bold">{roomTitle}</h1>
                  {friendlyScore !== null && <div className="flex items-center gap-1.5 mt-0.5"><span className="text-[10px] text-[#8E8E93]">AI 친밀도</span><div className={`w-1.5 h-1.5 rounded-full ${friendlyScore >= 80 ? 'bg-[#30D158]' : friendlyScore >= 40 ? 'bg-[#FFD60A]' : 'bg-[#FF453A]'}`} /><span className={`text-[11px] font-bold ${friendlyScore >= 80 ? 'text-[#30D158]' : friendlyScore >= 40 ? 'text-[#FFD60A]' : 'text-[#FF453A]'}`}>{friendlyScore}</span></div>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setIsSearching(true)} className="p-2 hover:text-brand-DEFAULT transition-colors"><Search className="w-6 h-6" /></button>
                <button onClick={() => navigate(`/chat/room/${chatId}/settings`)} className="p-2 hover:text-brand-DEFAULT transition-colors"><MoreHorizontal className="w-6 h-6" /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {isLoading ? <div className="flex justify-center items-center h-full text-[#8E8E93] text-sm">로딩 중...</div> : messages.length === 0 ? <div className="flex flex-col justify-center items-center h-full text-[#8E8E93] opacity-50 gap-2"><Smile className="w-8 h-8" /><p className="text-sm">대화를 시작해보세요!</p></div> : messages.map((msg, index) => {
            const isMe = msg.sender_id === user?.id;
            const showProfile = !isSearching && !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);
            return (
              <motion.div key={msg.id} ref={(el) => { messageRefs.current[msg.id] = el; }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && <div className={`w-8 h-8 rounded-xl bg-[#3A3A3C] mr-2 shrink-0 overflow-hidden ${!showProfile ? 'invisible' : ''}`}><img src={roomMembers.find(f => f.id === Number(msg.sender_id))?.avatar || `https://i.pravatar.cc/150?u=${msg.sender_id}`} className="w-full h-full object-cover" alt="" /></div>}
                <div className={`max-w-[85%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {!isMe && showProfile && <span className="text-[11px] text-[#8E8E93] mb-1 ml-1">상대방</span>}
                  {renderMessageContent(msg, isMe)}
                  <span className="text-[10px] text-[#636366] mt-1 px-1">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </motion.div>
            );
          })}
        <div ref={scrollRef} />
      </div>

      <div className="shrink-0 bg-[#1C1C1E] border-t border-[#2C2C2E] px-3 py-3 pb-safe z-50 overflow-visible">
        <AnimatePresence>
          {showMentionList && filteredMentionFriends.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-[80px] left-3 right-3 bg-[#2C2C2E]/95 border border-[#3A3A3C] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] backdrop-blur-xl">
              <div className="px-4 py-2.5 border-b border-white/5 bg-white/5 flex items-center gap-2"><AtSign className="w-3.5 h-3.5 text-brand-DEFAULT" /><span className="text-[11px] text-[#8E8E93] font-bold tracking-tight">참여자 멘션</span></div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {filteredMentionFriends.map(f => (
                  <button key={f.id} onClick={() => handleMentionSelect(f.name)} className={`w-full flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-none group transition-all ${f.name === '나' ? 'opacity-50 cursor-default pointer-events-none' : 'hover:bg-brand-DEFAULT/15 active:bg-brand-DEFAULT/20'}`}>
                    <div className="w-10 h-10 rounded-xl bg-[#3A3A3C] overflow-hidden flex items-center justify-center shrink-0 border border-white/5 group-hover:border-brand-DEFAULT/40">{f.avatar ? <img src={f.avatar} className="w-full h-full object-cover" alt="" /> : <UserIcon className="w-5 h-5 text-[#8E8E93]" />}</div>
                    <div className="flex-1 flex items-center gap-1.5 text-left"><span className="text-[15px] font-medium text-white group-hover:text-brand-DEFAULT">{f.name}</span>{f.name === '나' && <span className="text-[12px] text-brand-DEFAULT/70 font-bold">(나)</span>}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-3 h-[44px]">
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`w-[40px] h-[40px] flex items-center justify-center text-[#8E8E93] bg-[#2C2C2E] rounded-full transition-all shrink-0 hover:text-white ${isMenuOpen ? 'rotate-45 text-white bg-[#3A3A3C]' : ''}`}><Plus className="w-6 h-6" /></button>
          <div className="flex-1 h-full bg-[#2C2C2E] rounded-[22px] border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-all px-4 flex items-center gap-2">
            <textarea ref={inputRef} value={inputText} onChange={handleInputChange} onKeyDown={handleKeyDown} placeholder="메시지 보내기 (@멘션)" className="w-full bg-transparent text-white text-[15px] focus:outline-none resize-none placeholder-[#636366] leading-tight py-2" rows={1} style={{ height: '40px', lineHeight: '24px' }} />
            <button onClick={() => toast('준비중')} className="text-[#8E8E93] hover:text-white transition-colors shrink-0"><Smile className="w-6 h-6" /></button>
          </div>
          <button onClick={handleSendMessage} disabled={!inputText.trim()} className={`w-[40px] h-[40px] flex items-center justify-center rounded-full shrink-0 transition-all ${inputText.trim() ? 'bg-brand-DEFAULT text-white shadow-lg active:scale-90' : 'bg-[#2C2C2E] text-[#636366]'}`}><Send className="w-5 h-5" /></button>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-[#2C2C2E]/30 mt-3 rounded-2xl">
              <div className="grid grid-cols-4 gap-4 p-4">
                <MenuButton icon={<ImageIcon className="w-6 h-6" />} label="앨범" onClick={() => fileInputRef.current?.click()} />
                <MenuButton icon={<Camera className="w-6 h-6" />} label="카메라" onClick={() => cameraInputRef.current?.click()} />
                <MenuButton icon={<FileText className="w-6 h-6" />} label="파일" onClick={() => docInputRef.current?.click()} />
                <MenuButton icon={<Smile className="w-6 h-6" />} label="이모티콘" onClick={() => toast('준비 중입니다.')} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ImageViewerModal isOpen={isViewerOpen} initialIndex={initialImageIndex} images={allImages} onClose={() => setIsViewerOpen(false)} />
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" ref={docInputRef} onChange={handleFileUpload} className="hidden" />
    </div>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return <button onClick={onClick} className="flex flex-col items-center gap-2 group"><div className="w-14 h-14 bg-[#2C2C2E] rounded-[22px] flex items-center justify-center text-white border border-[#3A3A3C] group-hover:border-brand-DEFAULT group-hover:bg-[#3A3A3C] transition-all">{icon}</div><span className="text-[11px] text-[#8E8E93] group-hover:text-white transition-colors">{label}</span></button>;
}

function ImageViewerModal({ isOpen, initialIndex, images, onClose }: { isOpen: boolean, initialIndex: number, images: string[], onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  useEffect(() => { if (isOpen) setIndex(initialIndex); }, [isOpen, initialIndex]);
  const p = (d: number) => { const n = index + d; if (n >= 0 && n < images.length) { setDirection(d); setIndex(n); } };
  const handleDragEnd = (_: any, info: any) => { if (info.offset.x < -50 && index < images.length - 1) p(1); else if (info.offset.x > 50 && index > 0) p(-1); };
  if (!isOpen || images.length === 0) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-center overflow-hidden bg-black/98 backdrop-blur-2xl">
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between z-20"><span className="text-white/80 font-mono text-sm bg-black/40 px-3 py-1 rounded-full">{index + 1} / {images.length}</span><button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"><X className="w-6 h-6" /></button></div>
      {index > 0 && <button onClick={() => p(-1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full z-20 hidden md:block transition-all"><ChevronLeft className="w-8 h-8" /></button>}
      {index < images.length - 1 && <button onClick={() => p(1)} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 rounded-full z-20 hidden md:block transition-all"><ChevronRight className="w-8 h-8" /></button>}
      <div className="flex-1 flex items-center justify-center relative w-full h-full">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img key={index} src={images[index]} custom={direction} variants={{ enter: (d: number) => ({ x: d > 0 ? 600 : -600, opacity: 0, scale: 0.9 }), center: { x: 0, opacity: 1, scale: 1 }, exit: (d: number) => ({ x: d < 0 ? 600 : -600, opacity: 0, scale: 0.9 }) }} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 350, damping: 35 }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7} onDragEnd={handleDragEnd} className="absolute max-w-full max-h-full object-contain touch-none cursor-grab active:cursor-grabbing" alt="" />
        </AnimatePresence>
      </div>
    </div>
  );
}