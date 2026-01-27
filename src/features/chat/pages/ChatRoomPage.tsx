import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Plus, Send, Image as ImageIcon, Camera, 
  MapPin, FileText, User as UserIcon, Crop, X, CheckCircle2, Circle,
  Search, Settings 
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- [Types] ---
interface Message {
  id: number;
  text: string;
  sender: 'me' | 'other';
  timestamp: string;
  type: 'text' | 'image' | 'file';
}

// ✨ 멘션용 참여자 데이터 (실제로는 서버에서 가져옴)
const PARTICIPANTS = [
  { id: '1', name: '강민수', avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: '2', name: '김철수', avatar: 'https://i.pravatar.cc/150?u=4' },
  { id: '3', name: '박영희', avatar: null },
];

// --- [Mock Data] ---
const MOCK_MESSAGES: Message[] = [
  { id: 1, text: '안녕하세요! 프로젝트 진행 상황 어떠신가요?', sender: 'other', timestamp: '오후 2:30', type: 'text' },
  { id: 2, text: '거의 다 마무리 되어갑니다.', sender: 'me', timestamp: '오후 2:31', type: 'text' },
  { id: 3, text: '오, 정말요? 고생 많으셨습니다!', sender: 'other', timestamp: '오후 2:32', type: 'text' },
  { id: 4, text: '네, 이따가 정리해서 파일 보내드릴게요.', sender: 'me', timestamp: '오후 2:33', type: 'text' },
  { id: 5, text: '혹시 검색 기능도 추가되었나요?', sender: 'other', timestamp: '오후 2:34', type: 'text' },
  { id: 6, text: '네, 지금 상단 돋보기 버튼을 누르면 채팅 내용을 검색할 수 있습니다.', sender: 'me', timestamp: '오후 2:35', type: 'text' },
];

export default function ChatRoomPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();
  
  // 데이터 상태
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [inputText, setInputText] = useState('');
  
  // UI 상태
  const [isMenuOpen, setIsMenuOpen] = useState(false); 
  const [isCaptureMode, setIsCaptureMode] = useState(false); 
  const [selectedForCapture, setSelectedForCapture] = useState<number[]>([]);
  
  // 검색 상태
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  // ✨ 멘션 상태
  const [showMentionList, setShowMentionList] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 스크롤 하단 고정
  useEffect(() => {
    if (!isSearchOpen && !isCaptureMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMenuOpen, isSearchOpen, isCaptureMode]);

  // ✨ 입력값 변경 핸들러 (멘션 감지)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputText(value);

    // 마지막 단어가 '@'로 시작하는지 확인
    const words = value.split(' ');
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      setShowMentionList(true);
      setMentionQuery(lastWord.slice(1)); // '@' 제외한 검색어
    } else {
      setShowMentionList(false);
    }
  };

  // ✨ 멘션 선택 핸들러
  const handleSelectMention = (name: string) => {
    const words = inputText.split(' ');
    words.pop(); // 방금 입력하던 @... 제거
    const newValue = words.join(' ') + (words.length > 0 ? ' ' : '') + `@${name} `;
    setInputText(newValue);
    setShowMentionList(false);
    // 입력창 포커스 유지는 실제 구현 시 ref 사용 필요
  };

  // 메시지 전송
  const handleSend = () => {
    if (!inputText.trim()) return;
    const newMessage: Message = {
      id: Date.now(),
      text: inputText,
      sender: 'me',
      timestamp: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
      type: 'text',
    };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    setShowMentionList(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') handleSend();
  };

  const toggleCaptureSelection = (id: number) => {
    if (selectedForCapture.includes(id)) {
      setSelectedForCapture(prev => prev.filter(mid => mid !== id));
    } else {
      setSelectedForCapture(prev => [...prev, id]);
    }
  };

  const handleSaveCapture = () => {
    if (selectedForCapture.length === 0) return toast.error('캡처할 대화를 선택해주세요.');
    toast.success(`${selectedForCapture.length}개의 대화가 저장되었습니다.`);
    setIsCaptureMode(false);
    setSelectedForCapture([]);
  };

  const renderHighlightedText = (text: string) => {
    if (!searchKeyword.trim()) return text;
    const regex = new RegExp(`(${searchKeyword})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <span key={i} className="bg-[#FFD700] text-black font-bold px-0.5 rounded-sm">{part}</span> : part
    );
  };

  const handleGoSettings = () => {
    navigate(`/chat/room/${chatId}/settings`);
  };

  // 멘션 필터링
  const filteredParticipants = PARTICIPANTS.filter(p => p.name.includes(mentionQuery));

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden relative">
      
      {/* Header */}
      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-30">
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
            <ChevronLeft className="w-7 h-7" />
          </button>
          {!isCaptureMode && (
            <div className="ml-1 flex flex-col">
              <span className="font-bold text-base leading-tight">강민수</span>
              <span className="text-[10px] text-[#8E8E93]">현재 활동 중</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1 pr-2">
          {isCaptureMode ? (
            <div className="flex items-center gap-3">
              <button onClick={() => setIsCaptureMode(false)} className="text-sm text-[#8E8E93]">취소</button>
              <button onClick={handleSaveCapture} className="text-sm font-bold text-brand-DEFAULT">저장</button>
            </div>
          ) : (
            <>
              <button onClick={() => { setIsSearchOpen(!isSearchOpen); setSearchKeyword(''); }} className={`p-2 rounded-full transition-colors ${isSearchOpen ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}>
                <Search className="w-6 h-6" />
              </button>
              <button onClick={handleGoSettings} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
                <Settings className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Search Bar */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="bg-[#2C2C2E] shrink-0 overflow-hidden z-20 border-b border-black/20">
            <div className="px-4 py-3 flex items-center gap-2">
              <div className="flex-1 h-9 bg-dark-bg rounded-xl flex items-center px-3 border border-[#3A3A3C]">
                <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
                <input type="text" value={searchKeyword} onChange={(e) => setSearchKeyword(e.target.value)} placeholder="대화 내용 검색" className="w-full bg-transparent text-sm text-white placeholder-[#636366] focus:outline-none" autoFocus />
                {searchKeyword && <button onClick={() => setSearchKeyword('')}><X className="w-4 h-4 text-[#8E8E93]" /></button>}
              </div>
              <button onClick={() => setIsSearchOpen(false)} className="text-xs text-[#8E8E93] px-1 whitespace-nowrap">닫기</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-dark-bg relative" onClick={() => setIsMenuOpen(false)}>
        {messages.map((msg) => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className={`flex items-end gap-2 ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`} onClick={() => isCaptureMode && toggleCaptureSelection(msg.id)}>
            {isCaptureMode && (
              <div className="mb-2 shrink-0">
                {selectedForCapture.includes(msg.id) ? <CheckCircle2 className="w-5 h-5 text-brand-DEFAULT fill-brand-DEFAULT/20" /> : <Circle className="w-5 h-5 text-[#3A3A3C]" />}
              </div>
            )}
            {msg.sender === 'other' && !isCaptureMode && (
              <div className="w-8 h-8 rounded-xl bg-[#3A3A3C] overflow-hidden shrink-0">
                <img src="https://i.pravatar.cc/150?u=2" alt="Other" className="w-full h-full object-cover" />
              </div>
            )}
            <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl text-[14px] leading-snug break-words relative ${msg.sender === 'me' ? 'bg-brand-DEFAULT text-white rounded-br-none' : 'bg-[#2C2C2E] text-[#E5E5EA] rounded-tl-none'} ${isCaptureMode && selectedForCapture.includes(msg.id) ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-bg' : ''}`}>
              {renderHighlightedText(msg.text)}
            </div>
            {!isCaptureMode && <span className="text-[9px] text-[#636366] min-w-fit mb-1">{msg.timestamp}</span>}
          </motion.div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* ✨ 멘션 리스트 팝업 (입력창 위) */}
      <AnimatePresence>
        {showMentionList && filteredParticipants.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-[70px] left-4 right-4 bg-[#2C2C2E] rounded-2xl border border-[#3A3A3C] overflow-hidden shadow-2xl z-40 max-h-[200px] overflow-y-auto custom-scrollbar"
          >
            <div className="px-4 py-2 text-xs text-[#8E8E93] font-bold border-b border-[#3A3A3C]">대화상대 멘션</div>
            {filteredParticipants.map(user => (
              <button 
                key={user.id} 
                onClick={() => handleSelectMention(user.name)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#3A3A3C] transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-full bg-[#3A3A3C] overflow-hidden">
                  {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 m-auto mt-2 text-[#8E8E93]" />}
                </div>
                <span className="text-sm text-white font-medium">{user.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      {!isCaptureMode && (
        <div className="shrink-0 z-20 bg-[#1C1C1E] border-t border-[#2C2C2E]">
          <div className="flex items-center gap-2 p-3">
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className={`p-2 rounded-full transition-transform duration-200 ${isMenuOpen ? 'rotate-45 bg-[#2C2C2E]' : ''}`}><Plus className={`w-6 h-6 ${isMenuOpen ? 'text-white' : 'text-[#8E8E93]'}`} /></button>
            <div className="flex-1 bg-[#2C2C2E] rounded-full h-10 flex items-center px-4">
              <input 
                type="text" 
                value={inputText} 
                onChange={handleInputChange} // ✨ 변경된 핸들러 연결
                onKeyDown={handleKeyDown} 
                placeholder="메시지 입력" 
                className="bg-transparent w-full text-white text-sm placeholder-[#636366] focus:outline-none" 
              />
            </div>
            <button onClick={handleSend} disabled={!inputText.trim()} className={`p-2.5 rounded-full transition-colors ${inputText.trim() ? 'bg-brand-DEFAULT text-white' : 'bg-[#2C2C2E] text-[#636366]'}`}><Send className="w-5 h-5 ml-0.5" /></button>
          </div>
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: "easeInOut" }} className="overflow-hidden bg-[#1C1C1E]">
                <div className="grid grid-cols-4 gap-y-6 gap-x-4 p-6 pt-2 pb-8">
                  <MenuIcon icon={<ImageIcon className="w-6 h-6" />} label="앨범" onClick={() => toast('사진첩 접근 (준비중)')} />
                  <MenuIcon icon={<Camera className="w-6 h-6" />} label="카메라" onClick={() => toast('카메라 실행 (준비중)')} />
                  <MenuIcon icon={<MapPin className="w-6 h-6" />} label="지도" onClick={() => toast('위치 공유 (준비중)')} />
                  <MenuIcon icon={<FileText className="w-6 h-6" />} label="파일" onClick={() => toast('파일 전송 (준비중)')} />
                  <MenuIcon icon={<UserIcon className="w-6 h-6" />} label="연락처" onClick={() => toast('연락처 전송 (준비중)')} />
                  <MenuIcon icon={<Crop className="w-6 h-6" />} label="캡처" onClick={() => { setIsMenuOpen(false); setIsCaptureMode(true); toast('캡처할 대화를 선택하세요.'); }} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function MenuIcon({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div className="w-14 h-14 rounded-2xl bg-[#2C2C2E] flex items-center justify-center text-[#E5E5EA] group-active:scale-95 group-active:bg-[#3A3A3C] transition-all">{icon}</div>
      <span className="text-xs text-[#8E8E93]">{label}</span>
    </button>
  );
}