import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Search, UserX, X, Loader2, Check, Ban, Unlock } from 'lucide-react';
import toast from 'react-hot-toast';

// === [Types] ===
interface BlockedUser {
  id: string;
  name: string;
  phone: string;
  avatar: string | null;
  isProfileHidden: boolean; // '메시지 차단, 프로필 비공개' 설정 여부
}

// === [Mock Data] ===
const MOCK_BLOCKED_USERS: BlockedUser[] = [
  { id: '1', name: '김스팸', phone: '010-1234-5678', avatar: null, isProfileHidden: false },
  { id: '2', name: '박광고', phone: '010-9876-5432', avatar: 'https://i.pravatar.cc/150?u=spam', isProfileHidden: true },
  { id: '3', name: '이전남친', phone: '010-5555-4444', avatar: null, isProfileHidden: false },
  { id: '4', name: '대출권유', phone: '010-1111-2222', avatar: null, isProfileHidden: false },
];

export default function BlockedFriendsPage() {
  const navigate = useNavigate();

  // === States ===
  const [users, setUsers] = useState<BlockedUser[]>(MOCK_BLOCKED_USERS);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 모달 관리
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false); // 로딩 상태

  // === Handlers ===

  // 1. 관리 모달 열기
  const openManageModal = (user: BlockedUser) => {
    setSelectedUser(user);
    setIsModalOpen(true);
    setIsLoadingAction(false);
  };

  // 2. 메시지 차단, 프로필 비공개 설정
  const handleToggleProfileHide = () => {
    if (!selectedUser) return;
    
    // 이미 설정되어 있다면 아무 동작 안함 (또는 해제 로직)
    if (selectedUser.isProfileHidden) return;

    setIsLoadingAction(true);

    // 로딩 시뮬레이션 (1초)
    setTimeout(() => {
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id ? { ...u, isProfileHidden: true } : u
      ));
      // 모달 내부 상태도 업데이트 (즉시 반영)
      setSelectedUser(prev => prev ? { ...prev, isProfileHidden: true } : null);
      
      setIsLoadingAction(false);
      toast.success('설정이 적용되었습니다.');
    }, 1000);
  };

  // 3. 차단 해제
  const handleUnblock = () => {
    if (!selectedUser) return;

    setIsModalOpen(false);
    
    // 리스트에서 제거 애니메이션을 위해 약간의 딜레이 후 상태 업데이트
    setTimeout(() => {
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      toast.success(`${selectedUser.name}님 차단이 해제되어 친구목록으로 이동하였습니다.`);
      setSelectedUser(null);
    }, 200);
  };

  // 검색 필터링
  const filteredUsers = users.filter(user => 
    user.name.includes(searchQuery) || user.phone.includes(searchQuery)
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === Header === */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">차단한 친구 관리</h1>
      </header>

      {/* === Content === */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Search Bar */}
        <div className="px-5 py-4 shrink-0">
          <div className="bg-[#2C2C2E] rounded-xl flex items-center px-4 py-3">
            <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
            <input 
              type="text" 
              placeholder="이름, 전화번호 검색" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="bg-transparent text-white placeholder-[#636366] text-sm w-full focus:outline-none" 
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X className="w-4 h-4 text-[#8E8E93]" />
              </button>
            )}
          </div>
        </div>

        {/* Count & List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-10">
          <p className="text-xs font-bold text-[#8E8E93] mb-3">
            친구 {filteredUsers.length}명
          </p>

          <div className="space-y-4">
            <AnimatePresence>
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <motion.div 
                    key={user.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {/* Avatar */}
                      <div className="w-11 h-11 rounded-full bg-[#3A3A3C] overflow-hidden flex items-center justify-center border border-[#3A3A3C]">
                        {user.avatar ? (
                          <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <UserX className="w-5 h-5 text-[#8E8E93]" />
                        )}
                      </div>
                      {/* Info */}
                      <div>
                        <p className="text-[15px] font-bold text-white">{user.name}</p>
                        <p className="text-[12px] text-[#8E8E93]">{user.phone}</p>
                      </div>
                    </div>
                    {/* Manage Button */}
                    <button 
                      onClick={() => openManageModal(user)}
                      className="px-3.5 py-1.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] rounded-lg text-xs font-medium text-[#E5E5EA] border border-[#3A3A3C] transition-colors"
                    >
                      관리
                    </button>
                  </motion.div>
                ))
              ) : (
                <div className="py-20 text-center text-[#8E8E93]">
                  차단한 친구가 없습니다.
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* === Manage Modal (Bottom Sheet) === */}
      <AnimatePresence>
        {isModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
              onClick={() => setIsModalOpen(false)} 
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} 
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-[480px] bg-[#1C1C1E] rounded-t-3xl overflow-hidden p-6 pb-10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex flex-col items-center mb-6">
                 <div className="w-10 h-1 rounded-full bg-[#3A3A3C] mb-6" />
                 <h3 className="text-lg font-bold text-white mb-1">{selectedUser.name} 님 관리</h3>
                 <p className="text-xs text-[#8E8E93]">차단 설정을 변경할 수 있습니다.</p>
              </div>

              <div className="space-y-3">
                
                {/* 1. 메시지 차단, 프로필 비공개 버튼 */}
                <button 
                  onClick={handleToggleProfileHide}
                  disabled={selectedUser.isProfileHidden} // 이미 설정됨
                  className={`w-full h-14 flex items-center justify-between px-5 rounded-2xl transition-all ${
                    selectedUser.isProfileHidden 
                      ? 'bg-brand-DEFAULT/10 border border-brand-DEFAULT text-brand-DEFAULT cursor-default' 
                      : 'bg-[#2C2C2E] text-white hover:bg-[#3A3A3C]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Ban className="w-5 h-5" />
                    <span className="font-medium">메시지 차단, 프로필 비공개</span>
                  </div>
                  
                  {/* Loading / Check Logic */}
                  <div className="w-6 h-6 flex items-center justify-center">
                    {isLoadingAction ? (
                      <Loader2 className="w-5 h-5 animate-spin text-[#8E8E93]" />
                    ) : selectedUser.isProfileHidden ? (
                      <Check className="w-5 h-5 text-brand-DEFAULT" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-[#636366]" />
                    )}
                  </div>
                </button>

                {/* 2. 차단 해제 버튼 */}
                <button 
                  onClick={handleUnblock}
                  className="w-full h-14 flex items-center gap-3 px-5 bg-[#2C2C2E] hover:bg-[#3A3A3C] rounded-2xl text-white transition-colors"
                >
                  <Unlock className="w-5 h-5 text-[#E5E5EA]" />
                  <span className="font-medium">차단 해제</span>
                </button>

              </div>

              <button 
                onClick={() => setIsModalOpen(false)}
                className="w-full mt-6 py-3 text-[#8E8E93] text-sm font-medium hover:text-white transition-colors"
              >
                닫기
              </button>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}