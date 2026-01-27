import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Bell, Users, Image, FileText, Link, 
  LogOut, ChevronRight, Download, ExternalLink,
  X, AlertTriangle, Search, CheckCircle2, Circle, ArrowLeft
} from 'lucide-react';
import toast from 'react-hot-toast';

// === [Mock Data] ===
const MOCK_MEDIA = [
  'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1682687221038-404670001d45?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1501854140884-074bf6bca23c?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=800&auto=format&fit=crop',
];

const MOCK_FILES = [
  { id: 1, name: '2024_사업계획서_최종.pdf', size: '2.4MB', date: '2024.01.20' },
  { id: 2, name: 'UI_디자인_가이드_v2.fig', size: '15.2MB', date: '2024.01.18' },
  { id: 3, name: '1월_회의록.docx', size: '45KB', date: '2024.01.15' },
  { id: 4, name: '견적서_수정본.xlsx', size: '120KB', date: '2024.01.10' },
  { id: 5, name: '참고_자료_모음.zip', size: '345MB', date: '2023.12.30' },
  { id: 6, name: '프로젝트_일정표.pdf', size: '1.1MB', date: '2023.12.25' },
];

const MOCK_LINKS = [
  { id: 1, title: '그레인 노션 페이지', url: 'https://notion.so/grayn', date: '어제' },
  { id: 2, title: '핀터레스트 레퍼런스', url: 'https://pinterest.com', date: '1월 20일' },
  { id: 3, title: '개발 문서 (API)', url: 'https://docs.grayn.com', date: '1월 15일' },
  { id: 4, title: '디자인 시스템 가이드', url: 'https://figma.com', date: '1월 10일' },
  { id: 5, title: '경쟁사 분석 보고서', url: 'https://google.drive.com', date: '1월 5일' },
];

const MOCK_FRIENDS = [
  { id: 1, name: '강민수', avatar: 'https://i.pravatar.cc/150?u=2' },
  { id: 2, name: 'Alice', avatar: 'https://i.pravatar.cc/150?u=3' },
  { id: 3, name: '김철수', avatar: 'https://i.pravatar.cc/150?u=4' },
  { id: 4, name: '박영희', avatar: null },
  { id: 5, name: '최지훈', avatar: null },
];

// View State Type
type ViewState = 'main' | 'media' | 'files' | 'links';

export default function ChatRoomSettingsPage() {
  const navigate = useNavigate();
  useParams(); 

  const [currentView, setCurrentView] = useState<ViewState>('main');
  const [isMuted, setIsMuted] = useState(false);

  // Modals
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Handlers
  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    toast.success(isMuted ? '알림이 켜졌습니다.' : '알림이 꺼졌습니다.');
  };

  const handleConfirmLeave = () => {
    setIsLeaveModalOpen(false);
    toast.success('채팅방을 나갔습니다.');
    navigate('/main/chats');
  };

  const handleDownload = (fileName: string) => {
    toast.success(`${fileName} 다운로드를 시작합니다.`);
  };

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank');
  };

  // === Render Sub Views ===
  
  // 1. Media Grid View
  if (currentView === 'media') {
    return (
      <SubPageView title="사진/동영상" onBack={() => setCurrentView('main')}>
        <div className="grid grid-cols-3 gap-1">
          {MOCK_MEDIA.map((src, i) => (
            <motion.button 
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => setSelectedImage(src)}
              className="aspect-square bg-[#3A3A3C] relative group overflow-hidden"
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
            </motion.button>
          ))}
        </div>
        <ImageDetailModal 
          isOpen={!!selectedImage}
          imageSrc={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      </SubPageView>
    );
  }

  // 2. File List View
  if (currentView === 'files') {
    return (
      <SubPageView title="파일" onBack={() => setCurrentView('main')}>
        <div className="px-5 py-4 space-y-3">
          {MOCK_FILES.map((file, i) => (
            <motion.div 
              key={file.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors group"
            >
              <div className="w-12 h-12 bg-[#3A3A3C] rounded-xl flex items-center justify-center shrink-0 text-[#8E8E93] group-hover:text-white transition-colors">
                <FileText className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-white truncate font-medium">{file.name}</p>
                <p className="text-xs text-[#8E8E93] mt-1">{file.date} • {file.size}</p>
              </div>
              <button 
                onClick={() => handleDownload(file.name)}
                className="p-2.5 text-[#8E8E93] hover:text-white hover:bg-[#48484A] rounded-full transition-colors"
              >
                <Download className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </div>
      </SubPageView>
    );
  }

  // 3. Link List View
  if (currentView === 'links') {
    return (
      <SubPageView title="링크" onBack={() => setCurrentView('main')}>
        <div className="px-5 py-4 space-y-3">
          {MOCK_LINKS.map((link, i) => (
            <motion.button 
              key={link.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleOpenLink(link.url)}
              className="w-full flex items-center gap-4 p-4 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors text-left group"
            >
              <div className="w-12 h-12 bg-[#3A3A3C] rounded-xl flex items-center justify-center shrink-0 text-brand-DEFAULT">
                <Link className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] text-white truncate font-medium">{link.title}</p>
                <p className="text-xs text-[#8E8E93] truncate mt-1 flex items-center gap-1">
                  {link.date} • <span className="underline decoration-[#8E8E93]/50">{link.url}</span>
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
            </motion.button>
          ))}
        </div>
      </SubPageView>
    );
  }

  // === Main Settings View ===
  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* Header */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">채팅방 설정</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        {/* Chat Info */}
        <div className="p-6 flex flex-col items-center border-b border-[#2C2C2E]">
          <div className="w-24 h-24 bg-[#3A3A3C] rounded-[30px] mb-4 flex items-center justify-center overflow-hidden border border-[#2C2C2E]">
             <div className="grid grid-cols-2 gap-1 p-2 w-full h-full">
                <div className="bg-[#48484A] rounded-lg"></div>
                <div className="bg-[#48484A] rounded-lg"></div>
                <div className="bg-[#48484A] rounded-lg"></div>
                <div className="bg-[#48484A] rounded-lg"></div>
             </div>
          </div>
          <h2 className="text-xl font-bold mb-1">개발팀 공지방</h2>
          <p className="text-[#8E8E93] text-sm">멤버 12명</p>
        </div>

        {/* Menu List */}
        <div className="px-5 mt-6 space-y-6">
          
          {/* Storage Section - Navigation Style */}
          <Section title="모아보기">
            <NavMenuItem 
              icon={<Image className="w-5 h-5" />} 
              label="사진/동영상" 
              count={MOCK_MEDIA.length}
              onClick={() => setCurrentView('media')}
            />
            <NavMenuItem 
              icon={<FileText className="w-5 h-5" />} 
              label="파일" 
              count={MOCK_FILES.length}
              onClick={() => setCurrentView('files')}
            />
            <NavMenuItem 
              icon={<Link className="w-5 h-5" />} 
              label="링크" 
              count={MOCK_LINKS.length}
              onClick={() => setCurrentView('links')}
            />
          </Section>

          {/* Settings Section */}
          <Section title="관리">
            <div className="flex items-center justify-between px-5 py-4 bg-[#2C2C2E] rounded-2xl border border-[#3A3A3C]">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-[#8E8E93]" />
                <span className="text-[15px] text-white">알림 끄기</span>
              </div>
              <button 
                onClick={handleToggleMute}
                className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out ${isMuted ? 'bg-brand-DEFAULT' : 'bg-[#48484A]'}`}
              >
                <motion.div 
                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                  animate={{ x: isMuted ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
            
            <NavMenuItem 
              icon={<Users className="w-5 h-5" />} 
              label="대화상대 초대" 
              onClick={() => setIsInviteModalOpen(true)}
            />
          </Section>

          {/* Danger Zone */}
          <div className="space-y-3 pt-4">
            <button 
              onClick={() => setIsLeaveModalOpen(true)}
              className="w-full py-4 bg-[#2C2C2E] text-[#FF453A] font-medium rounded-2xl flex items-center justify-center gap-2 hover:bg-[#3A3A3C] transition-colors border border-[#3A3A3C]"
            >
              <LogOut className="w-5 h-5" />
              채팅방 나가기
            </button>
          </div>

        </div>
      </div>

      {/* === Modals === */}
      
      {/* 1. 나가기 확인 모달 */}
      <LeaveChatModal 
        isOpen={isLeaveModalOpen} 
        onClose={() => setIsLeaveModalOpen(false)} 
        onConfirm={handleConfirmLeave} 
      />

      {/* 2. 초대 모달 */}
      <InviteMemberModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
      />

    </div>
  );
}

// === Sub Components ===

// Generic Sub-page layout
function SubPageView({ title, onBack, children }: { title: string, onBack: () => void, children: React.ReactNode }) {
  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden absolute inset-0 z-50"
    >
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={onBack} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ArrowLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">{title}</h1>
      </header>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {children}
      </div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2">{title}</h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}

function NavMenuItem({ icon, label, count, onClick }: { icon: React.ReactNode, label: string, count?: number, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 bg-[#2C2C2E] rounded-2xl border border-[#3A3A3C] hover:bg-[#3A3A3C] transition-colors group"
    >
      <div className="flex items-center gap-3">
        <div className="text-[#8E8E93] group-hover:text-white transition-colors">{icon}</div>
        <span className="text-[15px] text-white">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {count !== undefined && <span className="text-[13px] text-[#8E8E93]">{count}</span>}
        <ChevronRight className="w-4 h-4 text-[#636366]" />
      </div>
    </button>
  );
}

// Custom Modal Components
function LeaveChatModal({ isOpen, onClose, onConfirm }: { isOpen: boolean, onClose: () => void, onConfirm: () => void }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
        <div className="p-6">
          <div className="w-12 h-12 bg-[#FF453A]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-[#FF453A]" />
          </div>
          <h3 className="text-white font-bold text-lg mb-2">채팅방 나가기</h3>
          <p className="text-[#8E8E93] text-sm leading-relaxed">
            나가기를 하면 대화 내용이 모두 삭제되며<br/>복구할 수 없습니다.
          </p>
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button onClick={onClose} className="flex-1 text-[#8E8E93] font-medium text-[16px] hover:bg-[#2C2C2E] border-r border-[#3A3A3C]">취소</button>
          <button onClick={onConfirm} className="flex-1 text-[#FF453A] font-bold text-[16px] hover:bg-[#2C2C2E]">나가기</button>
        </div>
      </motion.div>
    </div>
  );
}

function InviteMemberModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState('');

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleInvite = () => {
    if (selectedIds.length === 0) return toast.error('초대할 대상을 선택해주세요.');
    toast.success(`${selectedIds.length}명을 초대했습니다.`);
    onClose();
    setSelectedIds([]);
  };

  const filteredFriends = MOCK_FRIENDS.filter(f => f.name.includes(search));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative z-10 w-full max-w-[340px] bg-[#1C1C1E] rounded-2xl overflow-hidden border border-[#2C2C2E] shadow-2xl h-[500px] flex flex-col">
        <div className="h-14 bg-[#2C2C2E] flex items-center justify-between px-4 shrink-0">
          <span className="w-6" />
          <h3 className="text-white font-bold text-base">대화상대 초대</h3>
          <button onClick={onClose}><X className="w-6 h-6 text-[#8E8E93]" /></button>
        </div>
        
        <div className="px-4 pb-2 bg-[#2C2C2E]">
          <div className="bg-[#3A3A3C] rounded-xl flex items-center px-3 py-2">
            <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="이름 검색" className="bg-transparent text-white text-sm w-full focus:outline-none placeholder-[#8E8E93]" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {filteredFriends.map(friend => {
            const isSelected = selectedIds.includes(friend.id);
            return (
              <div key={friend.id} onClick={() => toggleSelect(friend.id)} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${isSelected ? 'bg-brand-DEFAULT/10' : 'hover:bg-white/5'}`}>
                <div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">
                  {friend.avatar ? <img src={friend.avatar} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5 m-auto mt-2.5 opacity-50"/>}
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isSelected ? 'text-brand-DEFAULT' : 'text-white'}`}>{friend.name}</p>
                </div>
                {isSelected ? <CheckCircle2 className="w-5 h-5 text-brand-DEFAULT fill-brand-DEFAULT/20" /> : <Circle className="w-5 h-5 text-[#3A3A3C]" />}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-[#2C2C2E]">
          <button 
            onClick={handleInvite}
            disabled={selectedIds.length === 0}
            className={`w-full h-12 rounded-xl font-bold text-white transition-all ${selectedIds.length > 0 ? 'bg-brand-DEFAULT hover:bg-brand-hover shadow-lg' : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'}`}
          >
            초대하기 ({selectedIds.length})
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ✨ Image Detail Modal with Floating Download Button
function ImageDetailModal({ isOpen, imageSrc, onClose }: { isOpen: boolean, imageSrc: string | null, onClose: () => void }) {
  if (!isOpen || !imageSrc) return null;

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    toast.success('갤러리에 저장되었습니다.');
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black flex items-center justify-center" onClick={onClose}>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        className="relative w-full h-full flex items-center justify-center"
      >
        {/* Top Bar */}
        <div className="absolute top-0 left-0 w-full p-4 flex justify-end z-20">
          <button onClick={onClose} className="p-2 bg-black/40 rounded-full text-white backdrop-blur-md hover:bg-black/60 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Image */}
        <img src={imageSrc} alt="Detail" className="max-w-full max-h-full object-contain" />

        {/* Bottom Floating Action Button (FAB) */}
        <div className="absolute bottom-safe right-4 mb-4 z-20">
          <button 
            onClick={handleDownload}
            className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-black shadow-lg hover:bg-gray-200 transition-transform active:scale-95"
          >
            <Download className="w-6 h-6" />
          </button>
        </div>
      </motion.div>
    </div>
  );
}