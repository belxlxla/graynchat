import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Bell, BellOff, Image as ImageIcon, FileText, 
  Download, Search, Plus, User, LogOut, X, ChevronRight, PlayCircle 
} from 'lucide-react';
import toast from 'react-hot-toast';

// === [Mock Data] ===
const MEDIA_ITEMS = [
  { id: 1, type: 'image', date: '오늘', url: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?q=80&w=600&auto=format&fit=crop' },
  { id: 2, type: 'image', date: '오늘', url: 'https://images.unsplash.com/photo-1682695796954-bad0d0f59cea?q=80&w=600&auto=format&fit=crop' },
  { id: 3, type: 'video', date: '2026.01.25', url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=600&auto=format&fit=crop' },
  { id: 4, type: 'image', date: '2026.01.20', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?q=80&w=600&auto=format&fit=crop' },
  { id: 5, type: 'image', date: '2026.01.20', url: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?q=80&w=600&auto=format&fit=crop' },
  { id: 6, type: 'image', date: '2026.01.20', url: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=600&auto=format&fit=crop' },
  { id: 7, type: 'image', date: '2025.12.31', url: 'https://images.unsplash.com/photo-1501854140884-074bf86ee95c?q=80&w=600&auto=format&fit=crop' },
];

const FILE_ITEMS = [
  { id: 1, name: '2024_사업계획서.pdf', size: '2.4MB', date: '2024.01.20' },
  { id: 2, name: '기획안_v3_최종.pptx', size: '15.1MB', date: '2024.01.18' },
  { id: 3, name: '참고자료_이미지.zip', size: '45.2MB', date: '2024.01.15' },
  { id: 4, name: '회의록_240110.docx', size: '500KB', date: '2024.01.10' },
  { id: 5, name: '예산안.xlsx', size: '1.2MB', date: '2024.01.05' },
];

const PARTICIPANTS = [
  { id: 'me', name: '나 (임정민)', avatar: 'https://i.pravatar.cc/150?u=me', isMe: true },
  { id: 'friend', name: '강민수', avatar: 'https://i.pravatar.cc/150?u=2', isMe: false },
];

export default function ChatRoomSettingsPage() {
  const navigate = useNavigate();
  const { chatId } = useParams();

  // States
  const [isMuted, setIsMuted] = useState(false);
  
  // Media States
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isMediaListOpen, setIsMediaListOpen] = useState(false);
  
  // Other Modals
  const [isFileModalOpen, setIsFileModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  // Handlers
  const toggleMute = () => {
    setIsMuted(!isMuted);
    toast.success(!isMuted ? '알림이 꺼졌습니다.' : '알림이 설정되었습니다.');
  };

  const handleLeaveClick = () => {
    setIsLeaveModalOpen(true); 
  };

  const confirmLeaveChat = () => {
    setIsLeaveModalOpen(false);
    toast.success('채팅방을 나갔습니다.');
    navigate('/main/chats');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === Header === */}
      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold">채팅방 설정</h1>
        <button onClick={toggleMute} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          {isMuted ? <BellOff className="w-6 h-6 text-[#8E8E93]" /> : <Bell className="w-6 h-6" />}
        </button>
      </header>

      {/* === Content === */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        {/* 1. Profile Area */}
        <div className="flex flex-col items-center py-8 border-b border-[#2C2C2E]">
          <div className="w-24 h-24 rounded-[36px] overflow-hidden bg-[#3A3A3C] mb-4 border border-[#3A3A3C]">
            <img src={PARTICIPANTS[1].avatar} alt="Friend" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-xl font-bold">{PARTICIPANTS[1].name}</h2>
          <p className="text-sm text-[#8E8E93] mt-1">친구</p>
        </div>

        <div className="px-5 py-6 space-y-8">
          
          {/* 2. Media Section (Photos/Videos) */}
          <section>
            <div 
              onClick={() => setIsMediaListOpen(true)}
              className="flex items-center justify-between mb-3 cursor-pointer active:opacity-70 transition-opacity"
            >
              <h3 className="text-sm font-bold text-[#8E8E93]">사진/동영상</h3>
              <ChevronRight className="w-4 h-4 text-[#636366]" />
            </div>
            {/* 최근 5개만 가로 슬라이드 */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {MEDIA_ITEMS.slice(0, 5).map((item, index) => (
                <div 
                  key={item.id} 
                  onClick={() => setLightboxIndex(index)}
                  className="w-24 h-24 shrink-0 rounded-xl overflow-hidden bg-[#2C2C2E] relative cursor-pointer border border-[#3A3A3C]"
                >
                  <img src={item.url} alt="Media" className="w-full h-full object-cover" />
                  {item.type === 'video' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <PlayCircle className="w-8 h-8 text-white" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 3. File Section */}
          <section>
            <h3 className="text-sm font-bold text-[#8E8E93] mb-3">파일</h3>
            <button 
              onClick={() => setIsFileModalOpen(true)}
              className="w-full bg-[#2C2C2E] rounded-2xl p-4 flex items-center justify-between hover:bg-[#3A3A3C] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#3A3A3C] flex items-center justify-center">
                  <FileText className="w-5 h-5 text-[#8E8E93]" />
                </div>
                <div className="text-left">
                  <p className="text-[15px] font-bold text-white">주고받은 파일</p>
                  <p className="text-xs text-[#8E8E93]">{FILE_ITEMS.length}개</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#636366]" />
            </button>
          </section>

          {/* 4. Participants Section */}
          <section>
            <h3 className="text-sm font-bold text-[#8E8E93] mb-3">대화상대</h3>
            <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C]">
              
              {/* Invite Button */}
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="w-full p-4 flex items-center gap-3 hover:bg-[#3A3A3C] transition-colors"
              >
                <div className="w-10 h-10 rounded-full border border-[#3A3A3C] flex items-center justify-center">
                  <Plus className="w-5 h-5 text-[#8E8E93]" />
                </div>
                <span className="text-[15px] font-medium text-white">친구 더 초대하기</span>
              </button>

              {/* Participants List */}
              {PARTICIPANTS.map((user) => (
                <div key={user.id} className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">
                    <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[15px] font-bold text-white flex items-center gap-2">
                      {user.name}
                      {user.isMe && <span className="text-[10px] font-normal text-[#8E8E93] border border-[#636366] px-1.5 rounded-full">나</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 5. Leave Button */}
          <button 
            onClick={handleLeaveClick}
            className="w-full py-4 rounded-2xl bg-[#2C2C2E] text-[#FF453A] font-bold text-[15px] hover:bg-[#3A3A3C] flex items-center justify-center gap-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            채팅방 나가기
          </button>

        </div>
      </div>

      {/* === Modals === */}

      {/* 1. Image Lightbox */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <ImageLightbox 
            items={MEDIA_ITEMS} 
            initialIndex={lightboxIndex} 
            onClose={() => setLightboxIndex(null)} 
          />
        )}
      </AnimatePresence>

      {/* 2. Media List Modal (Updated Design) */}
      <MediaListModal 
        isOpen={isMediaListOpen}
        onClose={() => setIsMediaListOpen(false)}
        items={MEDIA_ITEMS}
        onSelect={(index) => setLightboxIndex(index)}
      />

      {/* 3. File List Modal */}
      <FileListModal 
        isOpen={isFileModalOpen} 
        onClose={() => setIsFileModalOpen(false)} 
        files={FILE_ITEMS}
      />

      {/* 4. Invite Modal */}
      <InviteFriendModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
      />

      {/* 5. Leave Chat Modal */}
      <LeaveChatModal 
        isOpen={isLeaveModalOpen} 
        onClose={() => setIsLeaveModalOpen(false)} 
        onConfirm={confirmLeaveChat} 
      />

    </div>
  );
}


// === [Sub Components] ===

// 1. Image Lightbox (Directional Slider)
const sliderVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 300 : -300,
    opacity: 0
  })
};

function ImageLightbox({ items, initialIndex, onClose }: { items: any[], initialIndex: number, onClose: () => void }) {
  const [[page, direction], setPage] = useState([initialIndex, 0]);
  const imageIndex = ((page % items.length) + items.length) % items.length;

  const paginate = (newDirection: number) => setPage([page + newDirection, newDirection]);

  // 다운로드 핸들러
  const handleDownload = () => {
    toast.success('앨범에 저장되었습니다.');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <div className="h-14 flex items-center justify-between px-4 z-10 absolute top-0 w-full">
        <span className="text-white font-medium">{imageIndex + 1} / {items.length}</span>
        <div className="flex gap-2">
          {/* 다운로드 버튼 */}
          <button onClick={handleDownload} className="p-2 text-white bg-black/20 rounded-full backdrop-blur-md">
            <Download className="w-6 h-6" />
          </button>
          <button onClick={onClose} className="p-2 text-white bg-black/20 rounded-full backdrop-blur-md">
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative overflow-hidden">
        <AnimatePresence initial={false} custom={direction}>
          <motion.img 
            key={page}
            src={items[imageIndex].url}
            custom={direction}
            variants={sliderVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = Math.abs(offset.x) * velocity.x;
              if (swipe < -100 || offset.x < -100) {
                paginate(1);
              } else if (swipe > 100 || offset.x > 100) {
                paginate(-1);
              }
            }}
            className="absolute max-w-full max-h-full object-contain"
          />
        </AnimatePresence>

        <button onClick={() => paginate(-1)} className="absolute left-4 p-2 text-white/50 hover:text-white bg-black/20 rounded-full backdrop-blur-sm z-20">
          <ChevronLeft className="w-8 h-8" />
        </button>
        <button onClick={() => paginate(1)} className="absolute right-4 p-2 text-white/50 hover:text-white bg-black/20 rounded-full backdrop-blur-sm z-20">
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
    </motion.div>
  );
}

// 2. ✨ [Updated] Media List Modal (Cleaner Grid Design)
function MediaListModal({ isOpen, onClose, items, onSelect }: { isOpen: boolean, onClose: () => void, items: any[], onSelect: (idx: number) => void }) {
  const groupedItems = useMemo(() => {
    const groups: { [key: string]: any[] } = {};
    items.forEach((item, index) => {
      if (!groups[item.date]) groups[item.date] = [];
      groups[item.date].push({ ...item, originalIndex: index });
    });
    return groups;
  }, [items]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} 
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="relative z-10 w-full h-[90vh] sm:h-[700px] sm:max-w-[480px] bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col"
      >
        <div className="h-14 flex items-center justify-between px-5 border-b border-[#2C2C2E] shrink-0">
          <h3 className="text-white font-bold text-lg">사진/동영상</h3>
          <button onClick={onClose}><X className="w-6 h-6 text-[#8E8E93]" /></button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pb-safe">
          {Object.entries(groupedItems).map(([date, group]) => (
            <div key={date}>
              <h4 className="text-sm font-bold text-[#8E8E93] px-4 py-2 sticky top-0 bg-[#1C1C1E]/95 backdrop-blur-sm z-10">
                {date}
              </h4>
              {/* ✨ 개선된 그리드: 1px 간격 + 검은색 배경 = 깔끔한 라인 효과 */}
              <div className="grid grid-cols-3 gap-[1px] bg-black">
                {group.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => { onSelect(item.originalIndex); onClose(); }} 
                    className="aspect-square relative cursor-pointer bg-[#2C2C2E] overflow-hidden"
                  >
                    <img src={item.url} alt="Thumbnail" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                    {item.type === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <PlayCircle className="w-8 h-8 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// 3. File List Modal
function FileListModal({ isOpen, onClose, files }: { isOpen: boolean, onClose: () => void, files: any[] }) {
  const [search, setSearch] = useState('');
  const handleDownload = (fileName: string) => toast.success(`'${fileName}' 다운로드가 완료되었습니다.`);
  const filtered = files.filter(f => f.name.includes(search));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-10 w-full h-[80vh] sm:h-[600px] sm:max-w-[480px] bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col">
        <div className="h-16 flex items-center justify-between px-5 border-b border-[#2C2C2E] shrink-0">
          <h3 className="text-white font-bold text-lg">파일 목록</h3>
          <button onClick={onClose}><X className="w-6 h-6 text-[#8E8E93]" /></button>
        </div>
        <div className="p-4 bg-[#1C1C1E]">
          <div className="bg-[#2C2C2E] rounded-xl flex items-center px-4 py-3">
            <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="파일 검색" className="bg-transparent text-white w-full text-sm focus:outline-none placeholder-[#636366]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-safe">
          {filtered.length > 0 ? filtered.map(file => (
            <div key={file.id} className="flex items-center justify-between p-4 border-b border-[#2C2C2E] last:border-none">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 rounded-lg bg-[#3A3A3C] flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-[#8E8E93]" /></div>
                <div className="min-w-0"><p className="text-[14px] font-bold text-white truncate">{file.name}</p><p className="text-[12px] text-[#8E8E93]">{file.size} • {file.date}</p></div>
              </div>
              <button onClick={() => handleDownload(file.name)} className="p-2 text-[#8E8E93] hover:text-brand-DEFAULT transition-colors"><Download className="w-5 h-5" /></button>
            </div>
          )) : <div className="py-20 text-center text-[#8E8E93]">검색 결과가 없습니다.</div>}
        </div>
      </motion.div>
    </div>
  );
}

// 4. Invite Friend Modal
function InviteFriendModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const FRIENDS = [{ id: 101, name: '김철수', avatar: 'https://i.pravatar.cc/150?u=4' }, { id: 102, name: '박영희', avatar: null }, { id: 103, name: '이민호', avatar: 'https://i.pravatar.cc/150?u=5' }];
  const toggleSelect = (id: number) => setSelectedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  const handleCreateGroup = () => { toast.success('새로운 그룹 채팅방이 생성되었습니다.'); navigate('/main/chats'); };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[340px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl h-[500px] flex flex-col border border-[#2C2C2E]">
        <div className="h-14 flex items-center justify-between px-5 bg-[#2C2C2E] shrink-0"><h3 className="text-white font-bold">친구 초대</h3><button onClick={onClose}><X className="w-6 h-6 text-[#8E8E93]" /></button></div>
        <div className="flex-1 overflow-y-auto p-2">{FRIENDS.map(f => (<div key={f.id} onClick={() => toggleSelect(f.id)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer ${selectedIds.includes(f.id) ? 'bg-brand-DEFAULT/10' : 'hover:bg-white/5'}`}><div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">{f.avatar ? <img src={f.avatar} className="w-full h-full object-cover"/> : <User className="w-5 h-5 m-auto mt-2.5 opacity-50"/>}</div><p className={`flex-1 text-sm font-medium ${selectedIds.includes(f.id) ? 'text-brand-DEFAULT' : 'text-white'}`}>{f.name}</p><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedIds.includes(f.id) ? 'border-brand-DEFAULT bg-brand-DEFAULT' : 'border-[#636366]'}`}>{selectedIds.includes(f.id) && <X className="w-3 h-3 text-white rotate-45" />}</div></div>))}</div>
        <div className="p-4 border-t border-[#2C2C2E]"><button onClick={handleCreateGroup} disabled={selectedIds.length === 0} className={`w-full h-12 rounded-xl font-bold transition-all ${selectedIds.length > 0 ? 'bg-brand-DEFAULT text-white' : 'bg-[#3A3A3C] text-[#636366]'}`}>{selectedIds.length}명 초대하여 그룹 생성</button></div>
      </motion.div>
    </div>
  );
}

// 5. Leave Chat Modal (Custom Dark)
function LeaveChatModal({ isOpen, onClose, onConfirm }: { isOpen: boolean, onClose: () => void, onConfirm: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
        <div className="p-6"><h3 className="text-white font-bold text-lg mb-2">채팅방 나가기</h3><p className="text-[#8E8E93] text-sm leading-relaxed">나가기를 하면 대화 내용이<br/>모두 삭제됩니다.</p></div>
        <div className="flex border-t border-[#3A3A3C] h-12"><button onClick={onClose} className="flex-1 text-[#8E8E93] font-medium text-[16px] hover:bg-[#2C2C2E] transition-colors border-r border-[#3A3A3C]">취소</button><button onClick={onConfirm} className="flex-1 text-[#FF453A] font-bold text-[16px] hover:bg-[#2C2C2E] transition-colors">나가기</button></div>
      </motion.div>
    </div>
  );
}