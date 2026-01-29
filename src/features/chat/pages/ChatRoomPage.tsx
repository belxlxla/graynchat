import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Send, Plus, MoreHorizontal, 
  ImageIcon, Smile, Search, Camera, 
  FileText, X, Download, ChevronUp, ChevronDown, AtSign, User as UserIcon,
  UserPlus, Ban, Unlock, ShieldAlert, ExternalLink
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

interface Friend {
  id: number;
  friend_user_id: string; 
  name: string;
  avatar: string | null;
  is_blocked?: boolean;
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

  const [isFriend, setIsFriend] = useState<boolean>(true);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);

  const [showUrlWarning, setShowUrlWarning] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');

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
    const myInfo: Friend = { id: -1, friend_user_id: user?.id || '', name: '나', avatar: user?.user_metadata?.avatar_url || null };
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

  const fetchInitialData = async () => {
    if (!chatId || !user) return;
    try {
      const friendUUID = chatId.split('_').find(id => id !== user.id);
      if (!friendUUID) throw new Error("Invalid Room ID");

      const { data: friendRecord, error: friendError } = await supabase
        .from('friends')
        .select('*')
        .eq('user_id', user.id)
        .eq('friend_user_id', friendUUID)
        .maybeSingle();

      if (friendError) throw friendError;

      if (friendRecord) {
        setRoomTitle(friendRecord.name);
        setFriendlyScore(friendRecord.friendly_score);
        setRoomMembers([{ 
          id: friendRecord.id, 
          friend_user_id: friendRecord.friend_user_id, 
          name: friendRecord.name, 
          avatar: friendRecord.avatar 
        }]);
        
        setIsFriend(true);
        setIsBlocked(!!friendRecord.is_blocked);
      } else {
        setIsFriend(false);
        setIsBlocked(false);

        const { data: userData } = await supabase
          .from('users')
          .select('name')
          .eq('id', friendUUID)
          .maybeSingle();
          
        setRoomTitle(userData?.name || '알 수 없는 사용자');
      }

      const { data: msgData, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', chatId)
        .order('created_at', { ascending: true }); 
      
      if (msgError) throw msgError;
      setMessages(msgData || []);
      
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsLoading(false); 
    }
  };

  useEffect(() => {
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

  const handleAddFriend = async () => {
    if (!chatId || !user) return;
    const friendUUID = chatId.split('_').find(id => id !== user.id);
    if (!friendUUID) return;

    const addToast = toast.loading('친구 추가 중...');
    try {
      const { data: targetUser } = await supabase.from('users').select('*').eq('id', friendUUID).single();
      
      const { error } = await supabase.from('friends').upsert({
        user_id: user.id,
        friend_user_id: friendUUID,
        name: targetUser?.name || roomTitle,
        avatar: targetUser?.avatar,
        status: targetUser?.status_message,
        is_blocked: false,
        friendly_score: 50 
      });
      if (error) throw error;
      
      setIsFriend(true);
      toast.success(`${targetUser?.name || roomTitle}님을 친구로 추가했습니다.`, { id: addToast });
      fetchInitialData();
    } catch {
      toast.error('친구 추가 실패', { id: addToast });
    }
  };

  const handleUnblock = async () => {
    if (!chatId || !user) return;
    const friendUUID = chatId.split('_').find(id => id !== user.id);
    if (!friendUUID) return;

    const unblockToast = toast.loading('차단 해제 중...');
    try {
      const { error } = await supabase
        .from('friends')
        .update({ is_blocked: false })
        .match({ friend_user_id: friendUUID, user_id: user.id });
        
      if (error) throw error;
      setIsBlocked(false);
      toast.success('차단이 해제되었습니다.', { id: unblockToast });
      fetchInitialData();
    } catch {
      toast.error('해제 실패', { id: unblockToast });
    }
  };

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
    if (!inputText.trim() || !chatId || !user || isBlocked) return;
    const textToSend = inputText;
    setInputText('');
    setIsMenuOpen(false);
    setShowMentionList(false);
    try {
      await supabase.from('chat_rooms').upsert({ 
        id: chatId, 
        title: roomTitle, 
        last_message: textToSend, 
        updated_at: new Date().toISOString() 
      });
      
      const { data: newMsg } = await supabase
        .from('messages')
        .insert({ 
          room_id: chatId, 
          sender_id: user.id, 
          content: textToSend, 
          is_read: false 
        })
        .select()
        .single();
        
      if (newMsg) setMessages((prev) => [...prev, newMsg]);
    } catch (error) { 
      toast.error('전송 실패'); 
      setInputText(textToSend); 
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user || isBlocked) return;
    const uploadToast = toast.loading('파일 전송 중...');
    try {
      const fileName = `${Date.now()}___${file.name.replace(/[^a-zA-Z0-9가-힣.]/g, '_')}`; 
      const { error: uploadError } = await supabase.storage.from('chat-uploads').upload(`${chatId}/${fileName}`, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage.from('chat-uploads').getPublicUrl(`${chatId}/${fileName}`);
      
      await supabase.from('chat_rooms').upsert({ 
        id: chatId, 
        title: roomTitle, 
        last_message: '파일을 보냈습니다.', 
        updated_at: new Date().toISOString() 
      });
      
      const { data: newMsg } = await supabase
        .from('messages')
        .insert({ 
          room_id: chatId, 
          sender_id: user.id, 
          content: publicUrl, 
          is_read: false 
        })
        .select()
        .single();
        
      if (newMsg) setMessages((prev) => [...prev, newMsg]);
      toast.success('전송 완료', { id: uploadToast });
    } catch { 
      toast.error('실패'); 
    } finally { 
      if (fileInputRef.current) fileInputRef.current.value = ''; 
    }
  };

  const handleLinkClick = (url: string, e: React.MouseEvent) => {
    if (!isFriend) {
      e.preventDefault();
      setPendingUrl(url);
      setShowUrlWarning(true);
    }
  };

  const renderMessageContent = (msg: Message, isMe: boolean) => {
    const type = getFileType(msg.content);
    if (type === 'image') return <div className="rounded-2xl overflow-hidden shadow-sm border border-[#3A3A3C] max-w-[240px]"><img src={msg.content} alt="" className="w-full h-auto object-cover cursor-pointer" onClick={() => { setInitialImageIndex(allImages.indexOf(msg.content)); setIsViewerOpen(true); }} /></div>;
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
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = msg.content.split(/((?:@[가-힣a-zA-Z0-9_]+)|(?:https?:\/\/[^\s]+))/g);

    return (
      <div className={`px-4 py-2.5 text-[15px] leading-relaxed break-words shadow-sm ${isMe ? 'bg-brand-DEFAULT text-white rounded-[20px] rounded-tr-none' : 'bg-[#2C2C2E] text-white rounded-[20px] rounded-tl-none border border-[#3A3A3C]'}`}>
        {parts.map((p, i) => {
          if (mentionRegex.test(p)) return <span key={i} className="font-bold text-blue-300 drop-shadow-sm">{p}</span>;
          if (urlRegex.test(p)) return <a key={i} href={p} target="_blank" rel="noopener noreferrer" onClick={(e) => handleLinkClick(p, e)} className="underline text-blue-400 hover:text-blue-300 transition-colors font-medium">{p}</a>;
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
      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E]/95 backdrop-blur-md border-b border-[#2C2C2E] shrink-0 z-30 sticky top-0">
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
                <button onClick={() => navigate('/main/chats')} className="p-2 hover:text-brand-DEFAULT active:opacity-50"><ChevronLeft className="w-7 h-7" /></button>
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

      <AnimatePresence>
        {!isLoading && (!isFriend || isBlocked) && (
          <motion.div initial={{ height: 0, opacity: 0, y: -20 }} animate={{ height: 'auto', opacity: 1, y: 0 }} exit={{ height: 0, opacity: 0, y: -20 }} className="bg-[#2C2C2E]/80 backdrop-blur-xl border-b border-[#3A3A3C] z-20 shrink-0 overflow-hidden shadow-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 gap-4">
              <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className={`w-12 h-12 rounded-[20px] flex items-center justify-center shrink-0 border border-white/5 ${isBlocked ? 'bg-[#EC5022]/10 text-[#EC5022]' : 'bg-brand-DEFAULT/10 text-brand-DEFAULT'}`}><ShieldAlert className="w-6 h-6" /></div>
                <div className="flex-1">
                  <p className="text-[14px] font-bold text-white tracking-tight leading-tight">{isBlocked ? '차단된 사용자' : '미등록 또는 삭제된 사용자'}</p>
                  <p className="text-[11px] text-[#8E8E93] mt-1 font-medium">{isBlocked ? '상대방에게 메시지를 보낼 수 없는 상태입니다.' : '친구 추가를 하시면 친밀도 분석 및 대화가 가능합니다.'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                {isBlocked ? (
                  <button onClick={handleUnblock} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-DEFAULT px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white shadow-lg"><Unlock className="w-4 h-4" /> 차단 해제</button>
                ) : (
                  <>
                    <button onClick={handleAddFriend} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-DEFAULT px-5 py-2.5 rounded-2xl text-[13px] font-bold text-white shadow-lg"><UserPlus className="w-4.5 h-4.5" /> 친구 추가</button>
                    <button onClick={() => toast('신고가 접수되었습니다.')} className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#3A3A3C] px-5 py-2.5 rounded-2xl text-[13px] font-bold text-[#EC5022]">차단/신고</button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
        {isLoading ? <div className="flex justify-center items-center h-full text-[#8E8E93] text-sm">로딩 중...</div> : messages.length === 0 ? <div className="flex flex-col justify-center items-center h-full text-[#8E8E93] opacity-50 gap-2"><Smile className="w-8 h-8" /><p className="text-sm">대화를 시작해보세요!</p></div> : messages.map((msg, index) => {
            const isMe = msg.sender_id === user?.id;
            const showProfile = !isSearching && !isMe && (index === 0 || messages[index - 1].sender_id !== msg.sender_id);
            return (
              <motion.div key={msg.id} ref={(el) => { messageRefs.current[msg.id] = el; }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'}`}>
                {!isMe && <div className={`w-8 h-8 rounded-xl bg-[#3A3A3C] mr-2 shrink-0 overflow-hidden ${!showProfile ? 'invisible' : ''}`}><img src={roomMembers.find(f => f.friend_user_id === msg.sender_id)?.avatar || `https://i.pravatar.cc/150?u=${msg.sender_id}`} className="w-full h-full object-cover" alt="" /></div>}
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

      <div className="shrink-0 bg-[#1C1C1E] border-t border-[#2C2C2E] px-3 py-3 pb-safe z-50 overflow-visible relative">
        {isBlocked && <div className="absolute inset-0 bg-[#1C1C1E]/80 backdrop-blur-sm z-[60] flex items-center justify-center"><p className="text-sm font-medium text-[#8E8E93] flex items-center gap-2"><Ban className="w-4 h-4" /> 차단된 사용자와는 대화할 수 없습니다.</p></div>}
        <AnimatePresence>
          {showMentionList && filteredMentionFriends.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-[80px] left-3 right-3 bg-[#2C2C2E]/95 border border-[#3A3A3C] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] backdrop-blur-xl">
              <div className="px-4 py-2.5 border-b border-white/5 bg-white/5 flex items-center gap-2"><AtSign className="w-3.5 h-3.5 text-brand-DEFAULT" /><span className="text-[11px] text-[#8E8E93] font-bold">참여자 멘션</span></div>
              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {filteredMentionFriends.map(f => (
                  <button key={f.friend_user_id} onClick={() => handleMentionSelect(f.name)} className={`w-full flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-none hover:bg-brand-DEFAULT/15 active:bg-brand-DEFAULT/20 ${f.name === '나' ? 'opacity-50 cursor-default pointer-events-none' : ''}`}>
                    <div className="w-10 h-10 rounded-xl bg-[#3A3A3C] overflow-hidden flex items-center justify-center shrink-0">{f.avatar ? <img src={f.avatar} className="w-full h-full object-cover" alt="" /> : <UserIcon className="w-5 h-5 text-[#8E8E93]" />}</div>
                    <div className="flex-1 flex items-center gap-1.5 text-left"><span className="text-[15px] font-medium text-white">{f.name}</span>{f.name === '나' && <span className="text-[12px] text-brand-DEFAULT/70 font-bold">(나)</span>}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-3 h-[44px]">
          <button disabled={isBlocked} onClick={() => setIsMenuOpen(!isMenuOpen)} className={`w-[40px] h-[40px] flex items-center justify-center text-[#8E8E93] bg-[#2C2C2E] rounded-full transition-all shrink-0 ${isMenuOpen ? 'rotate-45 text-white bg-[#3A3A3C]' : ''}`}><Plus className="w-6 h-6" /></button>
          <div className="flex-1 h-full bg-[#2C2C2E] rounded-[22px] border border-[#3A3A3C] px-4 flex items-center gap-2"><textarea ref={inputRef} value={inputText} onChange={handleInputChange} onKeyDown={handleKeyDown} disabled={isBlocked} placeholder={isBlocked ? "대화가 불가능합니다" : "메시지 보내기 (@멘션)"} className="w-full bg-transparent text-white text-[15px] focus:outline-none resize-none py-2" rows={1} style={{ height: '40px', lineHeight: '24px' }} /><button disabled={isBlocked} onClick={() => toast('준비중')} className="text-[#8E8E93] hover:text-white shrink-0"><Smile className="w-6 h-6" /></button></div>
          <button onClick={handleSendMessage} disabled={!inputText.trim() || isBlocked} className={`w-[40px] h-[40px] flex items-center justify-center rounded-full shrink-0 ${inputText.trim() && !isBlocked ? 'bg-brand-DEFAULT text-white' : 'bg-[#2C2C2E] text-[#636366]'}`}><Send className="w-5 h-5" /></button>
        </div>
        <AnimatePresence>{isMenuOpen && !isBlocked && (<motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-[#2C2C2E]/30 mt-3 rounded-2xl"><div className="grid grid-cols-4 gap-4 p-4"><MenuButton icon={<ImageIcon className="w-6 h-6" />} label="앨범" onClick={() => fileInputRef.current?.click()} /><MenuButton icon={<Camera className="w-6 h-6" />} label="카메라" onClick={() => cameraInputRef.current?.click()} /><MenuButton icon={<FileText className="w-6 h-6" />} label="파일" onClick={() => docInputRef.current?.click()} /><MenuButton icon={<Smile className="w-6 h-6" />} label="이모티콘" onClick={() => toast('준비 중')} /></div></motion.div>)}</AnimatePresence>
      </div>

      <ImageViewerModal isOpen={isViewerOpen} initialIndex={initialImageIndex} images={allImages} onClose={() => setIsViewerOpen(false)} />
      <UrlWarningModal isOpen={showUrlWarning} url={pendingUrl} onClose={() => setShowUrlWarning(false)} />
      <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} onChange={handleFileUpload} className="hidden" />
      <input type="file" ref={docInputRef} onChange={handleFileUpload} className="hidden" />
    </div>
  );
}

function UrlWarningModal({ isOpen, url, onClose }: { isOpen: boolean, url: string, onClose: () => void }) {
  if (!isOpen) return null;
  return (<div className="fixed inset-0 z-[100] flex items-center justify-center px-8"><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} /><motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] border border-[#3A3A3C] rounded-[40px] p-8 text-center shadow-2xl"><div className="w-16 h-16 bg-[#EC5022]/10 rounded-full flex items-center justify-center mx-auto mb-6"><ShieldAlert className="w-8 h-8 text-[#EC5022]" /></div><h3 className="text-xl font-bold text-white mb-3">주의하세요!</h3><p className="text-[13px] text-[#8E8E93] leading-relaxed mb-8">친구로 등록되지 않은 사용자가 보낸 링크입니다.<br/>피싱 위험이 있으니 주의하십시오.</p><div className="bg-[#2C2C2E] p-3 rounded-2xl mb-8 break-all"><p className="text-[11px] text-blue-400 font-medium font-mono">{url}</p></div><div className="flex flex-col gap-3"><button onClick={() => { window.open(url, '_blank'); onClose(); }} className="w-full py-4 bg-brand-DEFAULT text-white font-bold rounded-2xl flex items-center justify-center gap-2"><ExternalLink className="w-4 h-4" /> 무시하고 열기</button><button onClick={onClose} className="w-full py-4 bg-[#2C2C2E] text-[#8E8E93] font-bold rounded-2xl">취소</button></div></motion.div></div>);
}

function MenuButton({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return <button onClick={onClick} className="flex flex-col items-center gap-2 group"><div className="w-14 h-14 bg-[#2C2C2E] rounded-[22px] flex items-center justify-center text-white border border-[#3A3A3C] group-hover:border-brand-DEFAULT transition-all">{icon}</div><span className="text-[11px] text-[#8E8E93] group-hover:text-white transition-colors">{label}</span></button>;
}

function ImageViewerModal({ isOpen, initialIndex, images, onClose }: { isOpen: boolean, initialIndex: number, images: string[], onClose: () => void }) {
  const [index, setIndex] = useState(initialIndex);
  const [direction, setDirection] = useState(0);
  
  useEffect(() => { 
    if (isOpen) setIndex(initialIndex); 
  }, [isOpen, initialIndex]);

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
      <div className="flex-1 flex items-center justify-center relative w-full h-full">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.img 
            key={index} 
            src={images[index]} 
            custom={direction} 
            variants={{ 
              enter: (d: number) => ({ x: d > 0 ? 600 : -600, opacity: 0 }), 
              center: { x: 0, opacity: 1 }, 
              exit: (d: number) => ({ x: d < 0 ? 600 : -600, opacity: 0 }) 
            }} 
            initial="enter" 
            animate="center" 
            exit="exit" 
            className="absolute max-w-full max-h-full object-contain" 
          />
        </AnimatePresence>
      </div>
    </div>
  );
}