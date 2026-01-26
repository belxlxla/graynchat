import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Plus, Send, Image as ImageIcon, Camera, 
  MapPin, FileText, User, Crop, X, CheckCircle2, Circle,
  Search, Settings, Menu // 아이콘들
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
  const [isMenuOpen, setIsMenuOpen] = useState(false); // 하단 + 메뉴
  const [isCaptureMode, setIsCaptureMode] = useState(false); // 캡처 모드
  const [selectedForCapture, setSelectedForCapture] = useState<number[]>([]);
  
  // ✨ 검색 기능 상태
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 스크롤 하단 고정 (검색 중이 아닐 때만)
  useEffect(() => {
    if (!isSearchOpen && !isCaptureMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isMenuOpen, isSearchOpen, isCaptureMode]);

  // 메시지 전송 핸들러
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
  };

  // 엔터키 전송 (한글 중복 입력 방지)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter') handleSend();
  };

  // 캡처 선택 토글
  const toggleCaptureSelection = (id: number) => {
    if (selectedForCapture.includes(id)) {
      setSelectedForCapture(prev => prev.filter(mid => mid !== id));
    } else {
      setSelectedForCapture(prev => [...prev, id]);
    }
  };

  // 캡처 저장
  const handleSaveCapture = () => {
    if (selectedForCapture.length === 0) return toast.error('캡처할 대화를 선택해주세요.');
    toast.success(`${selectedForCapture.length}개의 대화가 저장되었습니다.`);
    setIsCaptureMode(false);
    setSelectedForCapture([]);
  };

  // ✨ 검색어 하이라이트 함수 (핵심 기능)
  const renderHighlightedText = (text: string) => {
    if (!searchKeyword.trim()) return text;
    
    // 정규식으로 검색어 찾기 (대소문자 무시)
    const regex = new RegExp(`(${searchKeyword})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) => 
      regex.test(part) ? (
        <span key={i} className="bg-[#FFD700] text-black font-bold px-0.5 rounded-sm">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === [Header] 상단 네비게이션 === */}
      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-30">
        {/* 뒤로가기 & 프로필 정보 */}
        <div className="flex items-center">
          <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
            <ChevronLeft className="w-7 h-7" />
          </button>
          
          {/* 캡처 모드가 아닐 때만 이름 표시 */}
          {!isCaptureMode && (
            <div className="ml-1 flex flex-col">
              <span className="font-bold text-base leading-tight">강민수</span>
              <span className="text-[10px] text-[#8E8E93]">현재 활동 중</span>
            </div>
          )}
        </div>
        
        {/* === [Header Right] 우측 상단 아이콘 영역 === */}
        <div className="flex items-center gap-1 pr-2">
          {isCaptureMode ? (
            // 캡처 모드일 때: 취소/저장 버튼
            <div className="flex items-center gap-3">
              <button onClick={() => setIsCaptureMode(false)} className="text-sm text-[#8E8E93]">취소</button>
              <button onClick={handleSaveCapture} className="text-sm font-bold text-brand-DEFAULT">저장</button>
            </div>
          ) : (
            // 일반 모드일 때: 검색, 설정 아이콘
            <>
              {/* ✨ 1. 채팅 검색 아이콘 */}
              <button 
                onClick={() => { setIsSearchOpen(!isSearchOpen); setSearchKeyword(''); }} 
                className={`p-2 rounded-full transition-colors ${isSearchOpen ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}
              >
                <Search className="w-6 h-6" />
              </button>
              
              {/* ✨ 2. 채팅방 설정 아이콘 */}
              <button 
                onClick={() => toast('채팅방 설정 (준비중)')} 
                className="p-2 text-white hover:text-brand-DEFAULT transition-colors"
              >
                <Settings className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* === [Search Bar] 검색창 슬라이드 다운 === */}
      <AnimatePresence>
        {isSearchOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#2C2C2E] shrink-0 overflow-hidden z-20 border-b border-black/20"
          >
            <div className="px-4 py-3 flex items-center gap-2">
              <div className="flex-1 h-9 bg-dark-bg rounded-xl flex items-center px-3 border border-[#3A3A3C]">
                <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
                <input 
                  type="text" 
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="대화 내용 검색"
                  className="w-full bg-transparent text-sm text-white placeholder-[#636366] focus:outline-none"
                  autoFocus
                />
                {searchKeyword && (
                  <button onClick={() => setSearchKeyword('')}>
                    <X className="w-4 h-4 text-[#8E8E93]" />
                  </button>
                )}
              </div>
              <button onClick={() => setIsSearchOpen(false)} className="text-xs text-[#8E8E93] px-1 whitespace-nowrap">
                닫기
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === [Chat List] 메시지 목록 === */}
      <div 
        className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3 bg-dark-bg relative"
        onClick={() => setIsMenuOpen(false)}
      >
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex items-end gap-2 ${msg.sender === 'me' ? 'justify-end' : 'justify-start'}`}
            onClick={() => isCaptureMode && toggleCaptureSelection(msg.id)}
          >
            {/* 캡처 모드: 선택 라디오 버튼 */}
            {isCaptureMode && (
              <div className="mb-2 shrink-0">
                {selectedForCapture.includes(msg.id) 
                  ? <CheckCircle2 className="w-5 h-5 text-brand-DEFAULT fill-brand-DEFAULT/20" />
                  : <Circle className="w-5 h-5 text-[#3A3A3C]" />
                }
              </div>
            )}

            {/* 상대방 프로필 (상대방 메시지일 때만) */}
            {msg.sender === 'other' && !isCaptureMode && (
              <div className="w-8 h-8 rounded-xl bg-[#3A3A3C] overflow-hidden shrink-0">
                <img src="https://i.pravatar.cc/150?u=2" alt="Other" className="w-full h-full object-cover" />
              </div>
            )}

            {/* 말풍선 본문 */}
            <div className={`max-w-[70%] px-3.5 py-2 rounded-2xl text-[14px] leading-snug break-words relative 
              ${msg.sender === 'me' 
                ? 'bg-brand-DEFAULT text-white rounded-br-none' 
                : 'bg-[#2C2C2E] text-[#E5E5EA] rounded-tl-none'
              }
              ${isCaptureMode && selectedForCapture.includes(msg.id) ? 'ring-2 ring-white ring-offset-2 ring-offset-dark-bg' : ''}
            `}>
              {/* ✨ 검색어 하이라이트 렌더링 */}
              {renderHighlightedText(msg.text)}
            </div>

            {/* 시간 표시 */}
            {!isCaptureMode && (
              <span className="text-[9px] text-[#636366] min-w-fit mb-1">
                {msg.timestamp}
              </span>
            )}
          </motion.div>
        ))}
        {/* 스크롤 하단 앵커 */}
        <div ref={messagesEndRef} />
      </div>

      {/* === [Bottom Area] 입력창 및 메뉴 (캡처 모드 아닐 때만) === */}
      {!isCaptureMode && (
        <div className="shrink-0 z-20 bg-[#1C1C1E] border-t border-[#2C2C2E]">
          {/* 입력창 영역 */}
          <div className="flex items-center gap-2 p-3">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`p-2 rounded-full transition-transform duration-200 ${isMenuOpen ? 'rotate-45 bg-[#2C2C2E]' : ''}`}
            >
              <Plus className={`w-6 h-6 ${isMenuOpen ? 'text-white' : 'text-[#8E8E93]'}`} />
            </button>
            
            <div className="flex-1 bg-[#2C2C2E] rounded-full h-10 flex items-center px-4">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지 입력"
                className="bg-transparent w-full text-white text-sm placeholder-[#636366] focus:outline-none"
              />
            </div>

            <button 
              onClick={handleSend}
              disabled={!inputText.trim()}
              className={`p-2.5 rounded-full transition-colors ${
                inputText.trim() 
                  ? 'bg-brand-DEFAULT text-white' 
                  : 'bg-[#2C2C2E] text-[#636366]'
              }`}
            >
              <Send className="w-5 h-5 ml-0.5" /> 
            </button>
          </div>

          {/* 하단 + 메뉴 (Drawer) */}
          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden bg-[#1C1C1E]"
              >
                <div className="grid grid-cols-4 gap-y-6 gap-x-4 p-6 pt-2 pb-8">
                  <MenuIcon icon={<ImageIcon className="w-6 h-6" />} label="앨범" onClick={() => toast('사진첩 접근 (준비중)')} />
                  <MenuIcon icon={<Camera className="w-6 h-6" />} label="카메라" onClick={() => toast('카메라 실행 (준비중)')} />
                  <MenuIcon icon={<MapPin className="w-6 h-6" />} label="지도" onClick={() => toast('위치 공유 (준비중)')} />
                  <MenuIcon icon={<FileText className="w-6 h-6" />} label="파일" onClick={() => toast('파일 전송 (준비중)')} />
                  <MenuIcon icon={<User className="w-6 h-6" />} label="연락처" onClick={() => toast('연락처 전송 (준비중)')} />
                  <MenuIcon 
                    icon={<Crop className="w-6 h-6" />} label="캡처" 
                    onClick={() => { setIsMenuOpen(false); setIsCaptureMode(true); toast('캡처할 대화를 선택하세요.'); }} 
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// === [Sub Component] 하단 메뉴 아이콘 ===
function MenuIcon({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 group">
      <div className="w-14 h-14 rounded-2xl bg-[#2C2C2E] flex items-center justify-center text-[#E5E5EA] group-active:scale-95 group-active:bg-[#3A3A3C] transition-all">
        {icon}
      </div>
      <span className="text-xs text-[#8E8E93]">{label}</span>
    </button>
  );
}