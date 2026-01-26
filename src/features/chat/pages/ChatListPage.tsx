import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import type { PanInfo } from 'framer-motion'; 
import { 
  MessageSquare, User as UserIcon, // Users 제거됨
  Trash2, Check, BellOff, Search, Plus 
} from 'lucide-react';
import toast from 'react-hot-toast';

// --- [Types] ---
interface ChatRoom {
  id: string;
  type: 'individual' | 'group';
  title: string;
  avatar: string | null;
  membersCount?: number;
  lastMessage: string;
  timestamp: string;
  unreadCount: number;
  isMuted?: boolean;
}

// --- [Mock Data] ---
const MOCK_CHAT_DATA: ChatRoom[] = [
  { id: '1', type: 'individual', title: '강민수', avatar: 'https://i.pravatar.cc/150?u=2', lastMessage: '오늘 저녁에 시간 괜찮으세요?', timestamp: '오후 8:30', unreadCount: 2 },
  { id: '2', type: 'group', title: '점심 메뉴 선정 위원회', membersCount: 4, avatar: null, lastMessage: '오늘 마라탕 어때요?', timestamp: '오후 1:15', unreadCount: 0, isMuted: true },
  { id: '3', type: 'individual', title: '1004천사', avatar: null, lastMessage: '네 알겠습니다. 내일 뵙겠습니다!', timestamp: '어제', unreadCount: 0 },
  { id: '4', type: 'group', title: '개발팀 공지방', membersCount: 12, avatar: null, lastMessage: '서버 점검 예정입니다. (22:00~)', timestamp: '어제', unreadCount: 5 },
  { id: '5', type: 'individual', title: 'Alice', avatar: 'https://i.pravatar.cc/150?u=3', lastMessage: 'Can you send me the file?', timestamp: '1월 24일', unreadCount: 1 },
];

export default function ChatListPage() {
  const [chats, setChats] = useState<ChatRoom[]>(MOCK_CHAT_DATA);
  const [searchQuery] = useState(''); // setSearchQuery 제거 (사용하지 않음)

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

  const filteredChats = chats.filter(chat => 
    chat.title.includes(searchQuery) || chat.lastMessage.includes(searchQuery)
  );

  return (
    <div className="w-full h-full flex flex-col bg-dark-bg text-white">
      {/* === Header === */}
      <header className="h-14 px-4 flex items-center justify-between bg-dark-bg sticky top-0 z-10 border-b border-[#2C2C2E] shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold ml-1">채팅</h1>
          <span className="text-xl font-bold text-brand-DEFAULT">
            {chats.reduce((acc, curr) => acc + curr.unreadCount, 0)}
          </span>
        </div>
        <div className="flex gap-1">
           <button className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
             <Search className="w-6 h-6" />
           </button>
           <button className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
             <Plus className="w-6 h-6" />
           </button>
        </div>
      </header>

      {/* === List === */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-4">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-[#8E8E93] gap-3">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p className="text-sm">대화 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredChats.map(chat => (
              <ChatListItem 
                key={chat.id} 
                data={chat} 
                onLeave={() => handleLeaveChat(chat.id)}
                onRead={() => handleMarkAsRead(chat.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// === [Item Component] ===
function ChatListItem({ 
  data, 
  onLeave, 
  onRead 
}: { 
  data: ChatRoom; 
  onLeave: () => void; 
  onRead: () => void; 
}) {
  const navigate = useNavigate();
  const controls = useAnimation();
  const SWIPE_THRESHOLD = -100; 

  const handleDragEnd = async (_: any, info: PanInfo) => {
    if (info.offset.x < SWIPE_THRESHOLD) {
      await controls.start({ x: -140 }); 
    } else {
      await controls.start({ x: 0 });
    }
  };

  const handleEnterChat = () => {
    navigate(`/chat/room/${data.id}`);
  };

  return (
    <div className="relative w-full h-[84px] overflow-hidden border-b border-[#2C2C2E] last:border-none bg-dark-bg">
      <div className="absolute inset-y-0 right-0 w-[140px] flex h-full z-0">
        <button 
          onClick={() => { onRead(); controls.start({ x: 0 }); }}
          className="w-[70px] h-full bg-[#3A3A3C] flex flex-col items-center justify-center text-[#E5E5EA] active:bg-[#48484A] transition-colors"
        >
          <Check className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">읽음</span>
        </button>
        <button 
          onClick={onLeave}
          className="w-[70px] h-full bg-[#FF453A] flex flex-col items-center justify-center text-white active:bg-red-600 transition-colors"
        >
          <Trash2 className="w-5 h-5 mb-1" />
          <span className="text-[10px] font-medium">나가기</span>
        </button>
      </div>

      <motion.div
        drag="x"
        dragConstraints={{ left: -140, right: 0 }}
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
                <span className="text-[#8E8E93] text-sm">({data.membersCount})</span>
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
              <div className="min-w-[18px] h-[18px] px-1.5 bg-[#FF453A] rounded-full flex items-center justify-center ml-2">
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