import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimation, AnimatePresence } from 'framer-motion';
import type { PanInfo } from 'framer-motion'; 
import { 
  User as UserIcon, Users, // ✨ MessageSquare 제거됨
  Trash2, Check, BellOff, Search, Plus, Pencil, X,
  ChevronRight, CheckCircle2, Circle, Settings 
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- [Types] ---
interface ChatRoom {
  id: string;
  type: 'individual' | 'group';
  title: string;
  hostName?: string;
  avatar: string | null;
  membersCount?: number;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isMuted?: boolean;
}

// 친구 데이터 타입
interface Friend {
  id: number;
  name: string;
  avatar: string | null;
}

// --- [Mock Data] ---
const MOCK_CHAT_DATA: ChatRoom[] = [
  { id: '1', type: 'individual', title: '강민수', avatar: 'https://i.pravatar.cc/150?u=2', lastMessage: '오늘 저녁에 시간 괜찮으세요?', timestamp: '오후 8:30', unreadCount: 2 },
  { id: '2', type: 'group', title: '김철수 외 3명', hostName: '김철수', membersCount: 4, avatar: null, lastMessage: '오늘 마라탕 어때요?', timestamp: '오후 1:15', unreadCount: 0, isMuted: true },
  { id: '3', type: 'individual', title: '1004천사', avatar: null, lastMessage: '네 알겠습니다. 내일 뵙겠습니다!', timestamp: '어제', unreadCount: 0 },
  { id: '4', type: 'group', title: '개발팀 공지방', hostName: '팀장님', membersCount: 12, avatar: null, lastMessage: '서버 점검 예정입니다. (22:00~)', timestamp: '어제', unreadCount: 5 },
  { id: '5', type: 'individual', title: 'Alice', avatar: 'https://i.pravatar.cc/150?u=3', lastMessage: 'Can you send me the file?', timestamp: '1월 24일', unreadCount: 1 },
];

// 친구 목록 데이터
const MOCK_FRIENDS_DATA: Friend[] = [
  { id: 1, name: '1004천사', avatar: null },
  { id: 2, name: '강민수', avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: 3, name: 'Alice', avatar: 'https://i.pravatar.cc/150?u=3' },
  { id: 4, name: '김철수', avatar: 'https://i.pravatar.cc/150?u=4' },
  { id: 5, name: '박영희', avatar: null },
];

export default function ChatListPage() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatRoom[]>(MOCK_CHAT_DATA);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 모달 상태들
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingChat, setEditingChat] = useState<ChatRoom | null>(null);
  
  // 채팅방 생성 모달 상태
  const [isCreateChatOpen, setIsCreateChatOpen] = useState(false);

  // 설정 드롭다운 상태
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // 채팅방 나가기
  const handleLeaveChat = (id: string) => {
    if (confirm('채팅방을 나가시겠습니까?')) { 
      setChats(prev => prev.filter(chat => chat.id !== id));
      toast.success('채팅방을 나갔습니다.');
    }
  };

  // 읽음 처리
  const handleMarkAsRead = (id: string) => {
    setChats(prev => prev.map(chat => chat.id === id ? { ...chat, unreadCount: 0 } : chat));
    toast.success('읽음 처리되었습니다.');
  };

  // 채팅방 이름 수정
  const openEditModal = (chat: ChatRoom) => {
    setEditingChat(chat);
    setIsEditModalOpen(true);
  };

  const handleSaveTitle = (newTitle: string) => {
    if (editingChat) {
      setChats(prev => prev.map(c => c.id === editingChat.id ? { ...c, title: newTitle } : c));
      toast.success('채팅방 이름이 변경되었습니다.');
      setIsEditModalOpen(false);
      setEditingChat(null);
    }
  };

  // 드롭다운 메뉴 핸들러
  const handleGoFriends = () => {
    navigate('/settings/friends');
    setIsSettingsOpen(false);
  };

  const handleGoSettings = () => {
    navigate('/main/settings'); // 더보기(설정) 페이지로 이동
    setIsSettingsOpen(false);
  };

  const filteredChats = chats.filter(chat => 
    chat.title.includes(searchQuery) || chat.lastMessage.includes(searchQuery)
  );

  return (
    <div className="w-full h-full flex flex-col bg-dark-bg text-white">
      {/* === Header === */}
      <header className="h-14 px-4 flex items-center justify-between bg-dark-bg sticky top-0 z-50 border-b border-[#2C2C2E] shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold ml-1">채팅</h1>
          <span className="text-xl font-bold text-brand-DEFAULT">
            {chats.reduce((acc, curr) => acc + curr.unreadCount, 0)}
          </span>
        </div>
        <div className="flex gap-1 relative">
           <button 
             onClick={() => setIsSearching(!isSearching)} 
             className={`p-2 transition-colors ${isSearching ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}
           >
             <Search className="w-6 h-6" />
           </button>
           
           <button 
             onClick={() => setIsCreateChatOpen(true)}
             className="p-2 text-white hover:text-brand-DEFAULT transition-colors"
           >
             <Plus className="w-6 h-6" />
           </button>

           <button 
             onClick={() => setIsSettingsOpen(!isSettingsOpen)}
             className={`p-2 transition-colors ${isSettingsOpen ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}
           >
             <Settings className="w-6 h-6" />
           </button>

           <AnimatePresence>
             {isSettingsOpen && (
               <>
                 <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsSettingsOpen(false)} />
                 <motion.div 
                   initial={{ opacity: 0, y: -10, scale: 0.95 }} 
                   animate={{ opacity: 1, y: 0, scale: 1 }} 
                   exit={{ opacity: 0, y: -10, scale: 0.95 }}
                   transition={{ duration: 0.15 }}
                   className="absolute top-10 right-0 w-40 bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl shadow-xl z-50 overflow-hidden py-1.5"
                 >
                   <button 
                     onClick={handleGoFriends}
                     className="w-full text-left px-4 py-2.5 text-[14px] text-white hover:bg-[#3A3A3C] transition-colors"
                   >
                     친구 관리
                   </button>
                   <div className="h-[1px] bg-[#3A3A3C] mx-3 my-1" />
                   <button 
                     onClick={handleGoSettings}
                     className="w-full text-left px-4 py-2.5 text-[14px] text-white hover:bg-[#3A3A3C] transition-colors"
                   >
                     전체 설정
                   </button>
                 </motion.div>
               </>
             )}
           </AnimatePresence>
        </div>
      </header>

      {/* 검색바 */}
      <AnimatePresence>
        {isSearching && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="overflow-hidden px-5 py-2 bg-dark-bg shrink-0"
          >
            <div className="bg-[#2C2C2E] rounded-xl flex items-center px-4 py-2">
              <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
              <input 
                type="text" 
                placeholder="채팅방 이름, 참여자 검색" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="bg-transparent text-white placeholder-[#636366] text-sm w-full focus:outline-none" 
                autoFocus 
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X className="w-4 h-4 text-[#8E8E93]" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === List === */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-[#8E8E93] gap-3">
            <Search className="w-12 h-12 opacity-20" />
            <p className="text-sm">
              {searchQuery ? '검색 결과가 없습니다.' : '대화 내역이 없습니다.'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredChats.map(chat => (
              <ChatListItem 
                key={chat.id} 
                data={chat} 
                onLeave={() => handleLeaveChat(chat.id)}
                onRead={() => handleMarkAsRead(chat.id)}
                onEditTitle={() => openEditModal(chat)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 이름 수정 모달 */}
      <EditTitleModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        currentTitle={editingChat?.title || ''}
        onSave={handleSaveTitle}
      />

      {/* 채팅방 생성 모달 */}
      <CreateChatModal 
        isOpen={isCreateChatOpen} 
        onClose={() => setIsCreateChatOpen(false)} 
        friends={MOCK_FRIENDS_DATA} 
      />
    </div>
  );
}

// === [Item Component] ===
function ChatListItem({ 
  data, 
  onLeave, 
  onRead,
  onEditTitle
}: { 
  data: ChatRoom; 
  onLeave: () => void; 
  onRead: () => void; 
  onEditTitle: () => void;
}) {
  const navigate = useNavigate();
  const controls = useAnimation();
  
  const isGroup = data.type === 'group';
  const SWIPE_WIDTH = isGroup ? -210 : -140; 
  const ACTION_WIDTH = isGroup ? 210 : 140;

  const handleDragEnd = async (_: any, info: PanInfo) => {
    if (info.offset.x < -50) {
      await controls.start({ x: SWIPE_WIDTH }); 
    } else {
      await controls.start({ x: 0 });
    }
  };

  const handleEnterChat = () => {
    navigate(`/chat/room/${data.id}`);
  };

  return (
    <div className="relative w-full h-[84px] overflow-hidden border-b border-[#2C2C2E] last:border-none bg-dark-bg">
      <div 
        className="absolute inset-y-0 right-0 flex h-full z-0"
        style={{ width: `${ACTION_WIDTH}px` }}
      >
        {isGroup && (
          <button 
            onClick={() => { onEditTitle(); controls.start({ x: 0 }); }}
            className="flex-1 h-full bg-[#3A3A3C] border-r border-[#2C2C2E] flex flex-col items-center justify-center text-[#E5E5EA] active:bg-[#48484A] transition-colors"
          >
            <Pencil className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">이름변경</span>
          </button>
        )}
        <button 
          onClick={() => { onRead(); controls.start({ x: 0 }); }}
          className="flex-1 h-full bg-[#3A3A3C] flex flex-col items-center justify-center text-[#E5E5EA] active:bg-[#48484A] transition-colors"
        >
          <Check className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">읽음</span>
        </button>
        <button 
          onClick={onLeave}
          className="flex-1 h-full bg-[#EC5022] flex flex-col items-center justify-center text-white active:bg-red-600 transition-colors"
        >
          <Trash2 className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">나가기</span>
        </button>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: SWIPE_WIDTH, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={controls}
        onClick={handleEnterChat}
        className="relative w-full h-full bg-dark-bg flex items-center px-4 z-10 cursor-pointer active:bg-white/5 transition-colors"
        style={{ touchAction: 'pan-y' }}
      >
        <div className="relative shrink-0 mr-4">
          <div className="w-[52px] h-[52px] rounded-[20px] bg-[#3A3A3C] overflow-hidden flex items-center justify-center border border-[#2C2C2E]">
            {data.avatar ? (
              <img src={data.avatar} alt={data.title} className="w-full h-full object-cover" />
            ) : (
              data.type === 'group' ? (
                <div className="grid grid-cols-2 gap-0.5 p-1 w-full h-full">
                   <div className="bg-[#48484A] rounded-sm"></div>
                   <div className="bg-[#48484A] rounded-sm"></div>
                   <div className="bg-[#48484A] rounded-sm"></div>
                   <div className="bg-[#48484A] rounded-sm"></div>
                </div>
              ) : (
                <UserIcon className="w-6 h-6 text-[#8E8E93]" />
              )
            )}
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-center h-full py-1.5">
          <div className="flex justify-between items-center mb-1">
            <div className="flex items-center gap-1.5 overflow-hidden">
              <h3 className="text-[16px] font-bold text-white truncate max-w-[180px]">
                {data.title}
              </h3>
              {data.type === 'group' && data.membersCount && (
                <span className="text-[#8E8E93] text-sm flex items-center gap-0.5">
                  <Users className="w-3 h-3" /> {data.membersCount}
                </span>
              )}
              {data.isMuted && (
                <BellOff className="w-3 h-3 text-[#636366]" />
              )}
            </div>
            <span className="text-[11px] text-[#8E8E93] font-medium whitespace-nowrap ml-2">
              {data.timestamp}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <p className="text-[13px] text-[#8E8E93] truncate max-w-[220px] leading-snug">
              {data.lastMessage}
            </p>
            {data.unreadCount > 0 && (
              <div className="min-w-[18px] h-[18px] px-1.5 bg-[#EC5022] rounded-full flex items-center justify-center ml-2">
                <span className="text-[10px] font-bold text-white leading-none">
                  {data.unreadCount > 99 ? '99+' : data.unreadCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Edit Title Modal
function EditTitleModal({ 
  isOpen, 
  onClose, 
  currentTitle, 
  onSave 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  currentTitle: string; 
  onSave: (val: string) => void; 
}) {
  const [text, setText] = useState(currentTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(currentTitle);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, currentTitle]);

  const handleSubmit = () => {
    if (!text.trim()) return toast.error('채팅방 이름을 입력해주세요.');
    onSave(text);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()} className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E]">
        <div className="p-6">
          <h3 className="text-white font-bold text-lg mb-4 text-center">채팅방 이름 변경</h3>
          <div className="bg-[#2C2C2E] rounded-xl px-4 py-3 flex items-center mb-6">
            <input 
              ref={inputRef}
              type="text" 
              value={text} 
              onChange={(e) => setText(e.target.value)} 
              className="bg-transparent text-white text-base w-full focus:outline-none placeholder-[#636366] text-center"
              placeholder="채팅방 이름"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {text && <button onClick={() => setText('')}><X className="w-4 h-4 text-[#8E8E93]" /></button>}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 h-11 rounded-xl bg-[#3A3A3C] text-[#E5E5EA] font-bold text-sm hover:bg-[#48484A] transition-colors">취소</button>
            <button onClick={handleSubmit} className="flex-1 h-11 rounded-xl bg-brand-DEFAULT text-white font-bold text-sm hover:bg-brand-hover transition-colors">확인</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// 채팅방 생성 모달
function CreateChatModal({ isOpen, onClose, friends }: { isOpen: boolean; onClose: () => void; friends: Friend[] }) {
  const [step, setStep] = useState<'select-type' | 'select-friends'>('select-type');
  const [chatType, setChatType] = useState<'individual' | 'group'>('individual');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    if (isOpen) {
      setStep('select-type');
      setSelectedIds([]);
    }
  }, [isOpen]);

  const toggleSelection = (id: number) => { 
    if (chatType === 'individual') { 
      setSelectedIds([id]); 
    } else { 
      if (selectedIds.includes(id)) { 
        setSelectedIds(prev => prev.filter(pid => pid !== id)); 
      } else { 
        if (selectedIds.length >= 100) return toast.error('최대 100명까지만 초대 가능합니다.'); 
        setSelectedIds(prev => [...prev, id]); 
      } 
    } 
  };

  const handleCreate = () => { 
    if (selectedIds.length === 0) return toast.error('대화 상대를 선택해주세요.'); 
    toast.success(`${chatType === 'group' ? '그룹' : '1:1'} 채팅방이 생성되었습니다.`); 
    onClose(); 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div 
        initial={{ y: 50, opacity: 0 }} 
        animate={{ y: 0, opacity: 1 }} 
        onClick={(e) => e.stopPropagation()} 
        className="relative z-10 w-full max-w-[340px] bg-[#1C1C1E] rounded-2xl overflow-hidden border border-[#2C2C2E] shadow-2xl h-[500px] flex flex-col"
      >
        <div className="h-14 bg-[#2C2C2E] flex items-center justify-between px-4 flex-shrink-0">
          {step === 'select-friends' ? (
            <button onClick={() => setStep('select-type')}><ChevronRight className="w-6 h-6 rotate-180 text-white" /></button>
          ) : (<span />)}
          <h3 className="text-white font-bold text-base">
            {step === 'select-type' ? '새로운 채팅' : chatType === 'group' ? '대화 상대 초대' : '대화 상대 선택'}
          </h3>
          <button onClick={onClose}><X className="w-6 h-6 text-[#8E8E93]" /></button>
        </div>

        {step === 'select-type' && (
          <div className="flex-1 p-6 flex flex-col gap-4 justify-center">
            <button onClick={() => { setChatType('individual'); setStep('select-friends'); setSelectedIds([]); }} className="flex items-center gap-4 p-5 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors text-left group">
              <div className="w-12 h-12 rounded-full bg-brand-DEFAULT/10 flex items-center justify-center text-brand-DEFAULT group-hover:bg-brand-DEFAULT group-hover:text-white transition-colors">
                <UserIcon className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">1:1 채팅</h4>
                <p className="text-xs text-[#8E8E93]">친구 한 명과 대화합니다.</p>
              </div>
            </button>
            <button onClick={() => { setChatType('group'); setStep('select-friends'); setSelectedIds([]); }} className="flex items-center gap-4 p-5 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors text-left group">
              <div className="w-12 h-12 rounded-full bg-brand-DEFAULT/10 flex items-center justify-center text-brand-DEFAULT group-hover:bg-brand-DEFAULT group-hover:text-white transition-colors">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">그룹 채팅</h4>
                <p className="text-xs text-[#8E8E93]">여러 친구와 함께 대화합니다.</p>
              </div>
            </button>
          </div>
        )}

        {step === 'select-friends' && (
          <>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
              {friends.map(friend => { 
                const isSelected = selectedIds.includes(friend.id); 
                return (
                  <div key={friend.id} onClick={() => toggleSelection(friend.id)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-brand-DEFAULT/10' : 'hover:bg-white/5'}`}>
                    <div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">
                      {friend.avatar ? <img src={friend.avatar} className="w-full h-full object-cover"/> : <UserIcon className="w-5 h-5 m-auto mt-2.5 opacity-50"/>}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isSelected ? 'text-brand-DEFAULT' : 'text-white'}`}>{friend.name}</p>
                    </div>
                    {isSelected ? <CheckCircle2 className="w-5 h-5 text-brand-DEFAULT fill-brand-DEFAULT/20" /> : <Circle className="w-5 h-5 text-[#3A3A3C]" />}
                  </div>
                ) 
              })}
            </div>
            <div className="p-4 border-t border-[#2C2C2E]">
              <button 
                onClick={handleCreate} 
                disabled={selectedIds.length === 0} 
                className={`w-full h-12 rounded-xl font-bold text-white transition-all ${selectedIds.length > 0 ? 'bg-brand-DEFAULT hover:bg-brand-hover shadow-lg' : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'}`}
              >
                {selectedIds.length}명과 시작하기
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}