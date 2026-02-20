import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Search, UserX, X, Loader2, Check, Ban, Unlock, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
// ✨ Supabase 클라이언트 임포트
import { supabase } from '../../../shared/lib/supabaseClient';

// === [Types] ===
interface BlockedUser {
  id: string;
  name: string;
  phone: string;
  avatar_url: string | null;
  isProfileHidden: boolean; 
}

export default function BlockedFriendsPage() {
  const navigate = useNavigate();

  // === States ===
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true); 
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false); 

  // ✨ [수정] 차단된 유저 목록 가져오기 로직 강화
  const fetchBlockedUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('friends')
        .select('id, name, phone, avatar_url, hide_profile, is_blocked')
        .eq('is_blocked', true) // SQL에서 업데이트를 완료했다면 이 쿼리가 정확히 작동합니다.
        .order('name', { ascending: true });

      if (error) throw error;

      if (data) {
        const formattedData: BlockedUser[] = data.map((item: any) => ({
          id: item.id.toString(),
          name: item.name,
          phone: item.phone,
          avatar_url: item.avatar_url,
          isProfileHidden: item.hide_profile || false 
        }));
        setUsers(formattedData);
      }
    } catch (error: any) {
      console.error('Fetch Blocked Users Error:', error);
      if (error.code === '42703') {
        toast.error('DB 설정을 확인해주세요.');
      } else {
        toast.error('차단 목록을 불러오지 못했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedUsers();
  }, []);

  // === Handlers ===

  const openManageModal = (user: BlockedUser) => {
    setSelectedUser(user);
    setIsModalOpen(true);
    setIsLoadingAction(false);
  };

  // ✨ [수정] 설정 적용 시 로컬 상태를 즉시 반영하도록 수정
  const handleToggleProfileHide = async () => {
    if (!selectedUser || selectedUser.isProfileHidden) return;

    setIsLoadingAction(true);
    try {
      const { error } = await supabase
        .from('friends')
        .update({ hide_profile: true })
        .eq('id', selectedUser.id);

      if (error) throw error;

      // 1. 전체 리스트 상태 업데이트
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id ? { ...u, isProfileHidden: true } : u
      ));
      // 2. 모달 내 선택된 유저 상태 업데이트
      setSelectedUser(prev => prev ? { ...prev, isProfileHidden: true } : null);
      
      toast.success('설정이 적용되었습니다.');
    } catch (e) {
      toast.error('설정 저장에 실패했습니다.');
    } finally {
      setIsLoadingAction(false);
    }
  };

  // ✨ [수정] 차단 해제 시 즉시 리스트에서 제거되도록 순서 조정
  const handleUnblock = async () => {
    if (!selectedUser) return;

    const loadingToast = toast.loading('차단 해제 중...');
    try {
      const { error } = await supabase
        .from('friends')
        .update({ is_blocked: false, hide_profile: false })
        .eq('id', selectedUser.id);

      if (error) throw error;

      // 성공 시 즉시 모달 닫고 리스트에서 필터링
      setIsModalOpen(false);
      setUsers(prev => prev.filter(u => u.id !== selectedUser.id));
      
      toast.dismiss(loadingToast);
      toast.success(`${selectedUser.name}님 차단이 해제되었습니다.`);
      setSelectedUser(null);
    } catch (e) {
      toast.dismiss(loadingToast);
      toast.error('차단 해제에 실패했습니다.');
    }
  };

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    user.phone.includes(searchQuery)
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
          {isLoading ? (
            <div className="py-20 flex justify-center">
              <RefreshCw className="w-8 h-8 animate-spin text-brand-DEFAULT" />
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-[#8E8E93] mb-3">
                차단된 친구 {filteredUsers.length}명
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
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full bg-[#3A3A3C] overflow-hidden flex items-center justify-center border border-[#3A3A3C]">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              <UserX className="w-5 h-5 text-[#8E8E93]" />
                            )}
                          </div>
                          <div>
                            <p className="text-[15px] font-bold text-white">{user.name}</p>
                            <p className="text-[12px] text-[#8E8E93]">{user.phone}</p>
                          </div>
                        </div>
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
            </>
          )}
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
                <button 
                  onClick={handleToggleProfileHide}
                  disabled={selectedUser.isProfileHidden || isLoadingAction}
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
                  
                  <div className="w-6 h-6 flex items-center justify-center">
                    {isLoadingAction ? (
                      <Loader2 className="w-5 h-5 animate-spin text-brand-DEFAULT" />
                    ) : selectedUser.isProfileHidden ? (
                      <Check className="w-5 h-5 text-brand-DEFAULT" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-[#636366]" />
                    )}
                  </div>
                </button>

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