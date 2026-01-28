import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Send, Plus, MoreHorizontal, 
  Image as ImageIcon, Smile, Search, Camera, 
  FileText, X, Download, ChevronRight, Play, File, Film, Eye, Link as LinkIcon, ExternalLink 
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

// 파일 타입 상세 판별
const getFileType = (url: string) => {
  const ext = url.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
  if (['mp4', 'mov', 'webm', 'avi', 'm4v'].includes(ext || '')) return 'video';
  if (['pdf'].includes(ext || '')) return 'pdf';
  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp'].includes(ext || '')) return 'office';
  if (['txt', 'log', 'md', 'json'].includes(ext || '')) return 'text';
  return 'file';
};

// 파일명 추출 (특수문자/한글 완벽 복원)
const getFileName = (url: string) => {
  try {
    const decodedUrl = decodeURIComponent(url);
    const rawName = decodedUrl.split('/').pop() || 'file';
    if (rawName.includes('___')) {
      return rawName.split('___')[1]; 
    }
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
  // ✨ [New] 친밀도 점수 상태 추가
  const [friendlyScore, setFriendlyScore] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [inputText, setInputText] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [initialImageIndex, setInitialImageIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allImages = useMemo(() => {
    return messages
      .filter(m => getFileType(m.content) === 'image')
      .map(m => m.content);
  }, [messages]);

  const handleImageClick = (src: string) => {
    const index = allImages.indexOf(src);
    if (index !== -1) {
      setInitialImageIndex(index);
      setIsViewerOpen(true);
    }
  };

  const handleFileView = (url: string) => {
    const type = getFileType(url);
    if (type === 'pdf' || type === 'text') {
      window.open(url, '_blank');
    } else if (type === 'office') {
      window.open(`https://docs.google.com/viewer?url=${encodeURIComponent(url)}`, '_blank');
    } else {
      toast('미리보기를 지원하지 않는 파일입니다.\n다운로드해주세요.', { icon: 'ℹ️' });
    }
  };

  const handleFileDownload = async (url: string) => {
    const filename = getFileName(url);
    const loadingToast = toast.loading(`${filename}\n다운로드 중...`);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(blobUrl);
      document.body.removeChild(a);
      toast.success('저장 완료', { id: loadingToast });
    } catch (e) {
      toast.error('다운로드 실패', { id: loadingToast });
    }
  };

  const handleLinkOpen = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // 1. 초기 데이터 로드 (친구 정보 + 친밀도 + 메시지)
  useEffect(() => {
    if (!chatId) return;

    const fetchInitialData = async () => {
      try {
        // ✨ [수정됨] 친구 정보와 함께 친밀도(friendly_score) 가져오기
        const { data: friendData } = await supabase
          .from('friends')
          .select('name, friendly_score')
          .eq('id', chatId)
          .maybeSingle();

        if (friendData) {
          setRoomTitle(friendData.name);
          setFriendlyScore(friendData.friendly_score); // 점수 저장
        } else {
          const { data: roomData } = await supabase
            .from('chat_rooms')
            .select('title')
            .eq('id', chatId)
            .maybeSingle();
          setRoomTitle(roomData?.title || '알 수 없는 사용자');
          setFriendlyScore(null);
        }

        const { data: msgData, error: msgError } = await supabase
          .from('messages')
          .select('*')
          .eq('room_id', chatId)
          .order('created_at', { ascending: true }); 

        if (msgError) throw msgError;
        setMessages(msgData || []);

      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();

    const channel = supabase
      .channel(`room:${chatId}`) 
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${chatId}` }, 
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => { 
            if (prev.some(msg => msg.id === newMsg.id)) return prev; 
            return [...prev, newMsg]; 
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  useEffect(() => {
    if (scrollRef.current && !isSearching) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMenuOpen, isSearching]);

  const handleSendMessage = async () => {
    if (!inputText.trim() || !chatId || !user) return;
    const textToSend = inputText;
    setInputText('');
    setIsMenuOpen(false);
    try {
      await supabase.from('chat_rooms').upsert({ id: Number(chatId), title: roomTitle, last_message: textToSend, updated_at: new Date().toISOString() });
      const { data: newMsg, error: msgError } = await supabase.from('messages').insert({ room_id: Number(chatId), sender_id: user.id, content: textToSend, is_read: false }).select().single();
      if (msgError) throw msgError;
      if (newMsg) setMessages((prev) => [...prev, newMsg]);
    } catch (error) {
      console.error('Send Error:', error);
      toast.error('전송 실패');
      setInputText(textToSend);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;
    const uploadToast = toast.loading('파일 전송 중...');
    setIsMenuOpen(false);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9가-힣.]/g, '_'); 
      const fileName = `${Date.now()}___${safeName}`; 
      const filePath = `${chatId}/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('chat-uploads').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('chat-uploads').getPublicUrl(filePath);
      await supabase.from('chat_rooms').upsert({ id: Number(chatId), title: roomTitle, last_message: '파일을 보냈습니다.', updated_at: new Date().toISOString() });
      const { data: newMsg, error: msgError } = await supabase.from('messages').insert({ room_id: Number(chatId), sender_id: user.id, content: publicUrl, is_read: false }).select().single();
      if (msgError) throw msgError;
      if (newMsg) setMessages((prev) => [...prev, newMsg]);
      toast.success('전송 완료', { id: uploadToast });
    } catch (error) {
      toast.error('전송 실패', { id: uploadToast });
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMenuClick = (menuName: string) => {
    if (menuName === '앨범') fileInputRef.current?.click();
    else if (menuName === '카메라') cameraInputRef.current?.click();
    else if (menuName === '파일') docInputRef.current?.click();
    else toast(`${menuName} 기능 준비 중`, { icon: '🚧', style: { background: '#333', color: '#fff' } });
  };

  // 스마트 메시지 렌더러
  const renderMessageContent = (msg: Message, isMe: boolean) => {
    const type = getFileType(msg.content);
    const fileName = getFileName(msg.content);

    // 1. 이미지
    if (type === 'image') {
      return (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-[#3A3A3C] cursor-pointer active:opacity-80 transition-opacity max-w-[240px]">
          <img src={msg.content} alt="사진" className="w-full h-auto object-cover" loading="lazy" onClick={() => handleImageClick(msg.content)} />
        </div>
      );
    }

    // 2. 비디오
    if (type === 'video') {
      return (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-[#3A3A3C] max-w-[280px] bg-black">
          <video src={msg.content} controls playsInline className="w-full h-auto max-h-[300px]" />
        </div>
      );
    }

    // 3. 파일 (뷰어 + 다운로드)
    if (type === 'pdf' || type === 'file' || type === 'office' || type === 'text') {
      const isPdf = type === 'pdf';
      const isOffice = type === 'office';
      let FileIcon = File;
      let iconColor = "text-[#0A84FF]";
      if(isPdf) { FileIcon = FileText; iconColor = "text-[#EC5022]"; }
      else if(isOffice) { FileIcon = FileText; iconColor = "text-[#30D158]"; }

      return (
        <div className={`flex items-center gap-0 p-1.5 rounded-2xl max-w-[280px] group transition-colors ${isMe ? 'bg-[#2C2C2E] border border-[#3A3A3C]' : 'bg-[#2C2C2E] border border-[#3A3A3C]'}`}>
          <div onClick={() => handleFileView(msg.content)} className="flex-1 flex items-center gap-3 p-2 cursor-pointer hover:bg-white/5 rounded-xl transition-colors">
            <div className="w-10 h-10 rounded-xl bg-[#3A3A3C] flex items-center justify-center shrink-0 border border-white/5">
              <FileIcon className={`w-5 h-5 ${iconColor}`} />
            </div>
            <div className="flex-1 min-w-0 mr-1">
              <p className="text-[14px] text-white truncate leading-tight mb-0.5 font-medium">{fileName}</p>
              <div className="flex items-center gap-1">
                <p className="text-[10px] text-[#8E8E93] uppercase tracking-wide">{type.toUpperCase()}</p>
                {(isPdf || isOffice) && <Eye className="w-3 h-3 text-[#8E8E93]" />}
              </div>
            </div>
          </div>
          <div className="h-8 w-[1px] bg-white/10 mx-1" /> 
          <button onClick={() => handleFileDownload(msg.content)} className="p-3 text-[#8E8E93] hover:text-brand-DEFAULT hover:bg-white/5 rounded-xl transition-all active:scale-95 shrink-0" title="저장하기">
            <Download className="w-5 h-5" />
          </button>
        </div>
      );
    }

    // 4. 링크 메시지
    if (type === 'link') {
      return (
        <div 
          onClick={() => handleLinkOpen(msg.content)}
          className={`flex items-center gap-3 p-3.5 rounded-2xl max-w-[280px] cursor-pointer hover:bg-white/5 transition-colors group ${isMe ? 'bg-[#2C2C2E] border border-[#3A3A3C]' : 'bg-[#2C2C2E] border border-[#3A3A3C]'}`}
        >
          <div className="w-10 h-10 rounded-xl bg-[#3A3A3C] flex items-center justify-center shrink-0 border border-white/5">
            <LinkIcon className="w-5 h-5 text-brand-DEFAULT" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] text-brand-DEFAULT truncate leading-tight mb-0.5 font-medium underline decoration-brand-DEFAULT/30 underline-offset-2">
              {msg.content}
            </p>
            <div className="flex items-center gap-1 text-[#8E8E93]">
              <span className="text-[10px] uppercase tracking-wide">WEBSITE</span>
              <ExternalLink className="w-3 h-3" />
            </div>
          </div>
        </div>
      );
    }

    // 5. 일반 텍스트
    return (
      <div className={`px-4 py-2.5 text-[15px] leading-relaxed break-words shadow-sm ${
        isMe ? 'bg-brand-DEFAULT text-white rounded-[20px] rounded-tr-none' : 'bg-[#2C2C2E] text-white rounded-[20px] rounded-tl-none border border-[#3A3A3C]'
      }`}>
        {isSearching && searchQuery ? (
          <span dangerouslySetInnerHTML={{ __html: msg.content.replace(new RegExp(`(${searchQuery})`, 'gi'), '<span class="bg-yellow-500/50 text-white">$1</span>') }} />
        ) : msg.content}
      </div>
    );
  };

  const displayedMessages = isSearching && searchQuery ? messages.filter(m => m.content.includes(searchQuery)) : messages;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#1C1C1E] text-white">
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" ref={docInputRef} onChange={handleFileUpload} className="hidden" />

      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E]/95 backdrop-blur-md border-b border-[#2C2C2E] shrink-0 z-20 sticky top-0">
        {isSearching ? (
           <div className="flex items-center w-full gap-2 px-2">
             <div className="flex-1 h-9 bg-[#2C2C2E] rounded-xl flex items-center px-3 border border-brand-DEFAULT">
               <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
               <input autoFocus value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="대화 내용 검색" className="w-full bg-transparent text-sm text-white focus:outline-none placeholder-[#636366]" />
               {searchQuery && <button onClick={() => setSearchQuery('')} className="p-1"><X className="w-4 h-4 text-[#8E8E93]" /></button>}
             </div>
             <button onClick={() => { setIsSearching(false); setSearchQuery(''); }} className="text-sm text-white px-2">취소</button>
           </div>
        ) : (
          <>
            <div className="flex items-center">
              <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT"><ChevronLeft className="w-7 h-7" /></button>
              <div className="ml-1 flex flex-col justify-center">
                <h1 className="text-base font-bold leading-tight">{roomTitle}</h1>
                {/* ✨ [수정됨] 친밀도 AI 점수 표시 */}
                {friendlyScore !== null ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] text-[#8E8E93] font-medium">AI 친밀도</span>
                    <div className={`w-1.5 h-1.5 rounded-full ${friendlyScore >= 80 ? 'bg-[#30D158]' : friendlyScore >= 40 ? 'bg-[#FFD60A]' : 'bg-[#FF453A]'}`} />
                    <span className={`text-[11px] font-bold font-mono ${friendlyScore >= 80 ? 'text-[#30D158]' : friendlyScore >= 40 ? 'text-[#FFD60A]' : 'text-[#FF453A]'}`}>
                      {friendlyScore}
                    </span>
                  </div>
                ) : (
                  <span className="text-[11px] text-[#8E8E93]">대화방</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setIsSearching(true)} className="p-2 text-white hover:text-brand-DEFAULT"><Search className="w-6 h-6" /></button>
              <button onClick={() => navigate(`/chat/room/${chatId}/settings`)} className="p-2 text-white hover:text-brand-DEFAULT"><MoreHorizontal className="w-6 h-6" /></button>
            </div>
          </>
        )}
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {isLoading ? <div className="flex justify-center items-center h-full text-[#8E8E93] text-sm">대화 내용을 불러오는 중...</div> : displayedMessages.length === 0 ? <div className="flex flex-col justify-center items-center h-full text-[#8E8E93] opacity-50 gap-2"><Smile className="w-8 h-8" /><p className="text-sm">대화를 시작해보세요!</p></div> : displayedMessages.map((msg, index) => {
            const isMe = msg.sender_id === user?.id;
            const showProfile = !isSearching && !isMe && (index === 0 || displayedMessages[index - 1].sender_id !== msg.sender_id);
            return (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && <div className={`w-8 h-8 rounded-xl bg-[#3A3A3C] mr-2 shrink-0 overflow-hidden ${!showProfile ? 'invisible' : ''}`}><img src={`https://i.pravatar.cc/150?u=${msg.sender_id}`} className="w-full h-full object-cover" /></div>}
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

      {!isSearching && (
        <div className="shrink-0 bg-[#1C1C1E] border-t border-[#2C2C2E]">
          <div className="flex items-end gap-2 p-3">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-2.5 text-[#8E8E93] hover:text-white bg-[#2C2C2E] rounded-full transition-all shrink-0 ${isMenuOpen ? 'bg-[#3A3A3C] text-white rotate-45' : ''}`}><Plus className="w-5 h-5 transition-transform duration-300" /></button>
            <div className="flex-1 bg-[#2C2C2E] rounded-[24px] min-h-[44px] flex items-center px-4 py-2 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
              <textarea value={inputText} onChange={(e) => { setInputText(e.target.value); if(isMenuOpen) setIsMenuOpen(false); }} onKeyDown={handleKeyDown} placeholder="메시지 보내기" className="w-full bg-transparent text-white text-[15px] placeholder-[#636366] focus:outline-none resize-none max-h-[100px] py-1 custom-scrollbar" rows={1} style={{ height: 'auto', minHeight: '24px' }} />
            </div>
            <button onClick={handleSendMessage} disabled={!inputText.trim()} className={`p-2.5 rounded-full shrink-0 transition-all ${inputText.trim() ? 'bg-brand-DEFAULT text-white shadow-lg shadow-brand-DEFAULT/20' : 'bg-[#2C2C2E] text-[#636366]'}`}><Send className="w-5 h-5 fill-current" /></button>
          </div>
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeInOut" }} className="overflow-hidden bg-[#2C2C2E]/30">
                <div className="grid grid-cols-4 gap-4 p-4 pb-safe">
                  <MenuButton icon={<ImageIcon className="w-6 h-6" />} label="앨범" onClick={() => handleMenuClick('앨범')} />
                  <MenuButton icon={<Camera className="w-6 h-6" />} label="카메라" onClick={() => handleMenuClick('카메라')} />
                  <MenuButton icon={<FileText className="w-6 h-6" />} label="파일" onClick={() => handleMenuClick('파일')} />
                  <MenuButton icon={<Smile className="w-6 h-6" />} label="이모티콘" onClick={() => handleMenuClick('이모티콘')} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <ImageViewerModal isOpen={isViewerOpen} initialIndex={initialImageIndex} images={allImages} onClose={() => setIsViewerOpen(false)} />
    </div>
  );
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return <button onClick={onClick} className="flex flex-col items-center gap-2 group"><div className="w-14 h-14 bg-[#2C2C2E] rounded-[20px] flex items-center justify-center text-white border border-[#3A3A3C] group-hover:bg-[#3A3A3C] group-hover:border-brand-DEFAULT/50 transition-all">{icon}</div><span className="text-xs text-[#8E8E93] group-hover:text-white transition-colors">{label}</span></button>;
}

function ImageViewerModal({ isOpen, initialIndex, images, onClose }: { isOpen: boolean, initialIndex: number, images: string[], onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  useEffect(() => { if (isOpen) setIndex(initialIndex); }, [isOpen, initialIndex]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (!isOpen) return; if (e.key === 'ArrowLeft') p(-1); else if (e.key === 'ArrowRight') p(1); else if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [isOpen, index]);
  if (!isOpen || images.length === 0) return null;
  const p = (d: number) => { const n = index + d; if (n >= 0 && n < images.length) { setDirection(d); setIndex(n); } };
  const handleDragEnd = (_: any, info: any) => { if (info.offset.x < -50 && index < images.length - 1) p(1); else if (info.offset.x > 50 && index > 0) p(-1); };
  const handleDownload = async (e: React.MouseEvent) => { e.stopPropagation(); const t = toast.loading('다운로드 중...'); try { const r = await fetch(images[index]); const b = await r.blob(); const u = window.URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `photo_${Date.now()}.jpg`; document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(u); document.body.removeChild(a); toast.success('저장되었습니다.', { id: t }); } catch { toast.error('실패', { id: t }); } };
  const v = { enter: (d: number) => ({ x: d > 0 ? 500 : -500, opacity: 0 }), center: { x: 0, opacity: 1 }, exit: (d: number) => ({ x: d < 0 ? 500 : -500, opacity: 0 }) };
  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-center overflow-hidden bg-black/95 backdrop-blur-md">
      <div className="absolute top-0 left-0 w-full p-4 flex justify-between z-20"><span className="text-white font-bold drop-shadow-md bg-black/20 px-3 py-1 rounded-full text-sm">{index + 1} / {images.length}</span><button onClick={onClose} className="p-2 bg-white/10 rounded-full text-white backdrop-blur-md hover:bg-white/20"><X className="w-6 h-6" /></button></div>
      {index > 0 && <button onClick={() => p(-1)} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full z-20 hidden md:block"><ChevronLeft className="w-8 h-8" /></button>}
      {index < images.length - 1 && <button onClick={() => p(1)} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 text-white/70 hover:text-white bg-black/20 hover:bg-black/40 rounded-full z-20 hidden md:block"><ChevronRight className="w-8 h-8" /></button>}
      <div className="flex-1 flex items-center justify-center relative w-full h-full"><AnimatePresence initial={false} custom={direction} mode="popLayout"><motion.img key={index} src={images[index]} custom={direction} variants={v} initial="enter" animate="center" exit="exit" transition={{ type: "spring", stiffness: 300, damping: 30 }} drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.7} onDragEnd={handleDragEnd} className="absolute max-w-full max-h-full object-contain touch-none" /></AnimatePresence></div>
      <div className="absolute bottom-safe left-0 w-full flex justify-center pb-8 z-20"><button onClick={handleDownload} className="flex items-center gap-2 px-6 py-3 bg-white/10 backdrop-blur-lg border border-white/20 rounded-full text-white shadow-xl hover:bg-white/20 active:scale-95 transition-all"><Download className="w-5 h-5" /><span className="font-semibold text-sm">저장하기</span></button></div>
    </div>
  );
}