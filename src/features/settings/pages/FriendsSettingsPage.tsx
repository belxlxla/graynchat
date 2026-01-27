import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, UserPlus, RefreshCw, Contact, Ban } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FriendsSettingsPage() {
  const navigate = useNavigate();

  // === States ===
  const [autoAdd, setAutoAdd] = useState(true);
  const [useContactNames, setUseContactNames] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('2024.01.27 10:00');
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // 모달 상태
  const [showRefreshModal, setShowRefreshModal] = useState(false);

  // === Handlers ===

  const toggleAutoAdd = () => {
    const newState = !autoAdd;
    setAutoAdd(newState);
    toast.success(newState ? '자동 친구 추가가 활성화되었습니다.' : '자동 친구 추가가 해제되었습니다.');
  };

  const toggleContactNames = () => {
    const newState = !useContactNames;
    setUseContactNames(newState);
    toast.success(newState ? '연락처 이름으로 표시됩니다.' : '친구의 설정 이름으로 표시됩니다.');
  };

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);

    setTimeout(() => {
      const now = new Date();
      const timeString = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      
      setLastUpdated(timeString);
      setIsRefreshing(false);
      setShowRefreshModal(true);
    }, 1000);
  };

  // ✨ 수정된 부분: 라우터 연결
  const handleBlockedFriends = () => {
    navigate('/settings/friends/blocked'); 
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === Header === */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">친구</h1>
      </header>

      {/* === Content === */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pt-4">
        <div className="px-5 space-y-8">
          
          {/* Section 1: 친구 추가 */}
          <Section label="친구 추가">
            
            {/* 1. 자동 친구 추가 (토글) */}
            <div className="p-5 border-b border-[#3A3A3C]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">자동 친구 추가</span>
                </div>
                <Toggle isOn={autoAdd} onToggle={toggleAutoAdd} />
              </div>
              <p className="text-[13px] text-[#8E8E93] leading-relaxed">
                내 연락처에서 그레인을 사용하는 친구를 자동으로 친구목록에 추가합니다. 등록 가능한 친구가 최대 친구 수를 초과하는 경우에는 추가되지 않습니다.
              </p>
            </div>

            {/* 2. 친구 목록 새로고침 (액션) */}
            <div className="p-5 active:bg-[#3A3A3C] transition-colors cursor-pointer" onClick={handleRefresh}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <RefreshCw className={`w-5 h-5 text-[#8E8E93] ${isRefreshing ? 'animate-spin' : ''}`} />
                  <span className="text-[15px] text-white">친구 목록 새로고침</span>
                </div>
                {/* 새로고침 아이콘 (버튼 역할) */}
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[#3A3A3C]">
                  <RefreshCw className={`w-4 h-4 text-[#E5E5EA] ${isRefreshing ? 'animate-spin' : ''}`} />
                </div>
              </div>
              <p className="text-[13px] text-[#8E8E93] leading-relaxed mb-2">
                내 연락처에 있는 친구를 친구목록에 즉시 추가합니다.<br/>
                친구의 프로필 등 변경된 정보를 업데이트 합니다.
              </p>
              <p className="text-[12px] text-[#636366]">
                최종 업데이트: {lastUpdated}
              </p>
            </div>
          </Section>

          {/* Section 2: 친구 이름 */}
          <Section label="친구 이름">
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Contact className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">연락처 이름 가져오기</span>
                </div>
                <Toggle isOn={useContactNames} onToggle={toggleContactNames} />
              </div>
              <p className="text-[13px] text-[#8E8E93] leading-relaxed">
                내 연락처에 저장되어있는 이름으로 친구목록에 동일한 이름으로 노출됩니다.
              </p>
            </div>
          </Section>

          {/* Section 3: 친구 관리 */}
          <Section label="친구 관리">
            <button 
              onClick={handleBlockedFriends}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Ban className="w-5 h-5 text-[#8E8E93]" />
                <span className="text-[15px] text-white">차단한 친구 관리</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
            </button>
          </Section>

        </div>
      </div>

      {/* === Modals === */}
      <AlertModal 
        isOpen={showRefreshModal}
        onClose={() => setShowRefreshModal(false)}
        title="새로고침 완료"
        content="친구 목록이 새로고침 되었습니다."
      />

    </div>
  );
}

// === [Sub Components] ===

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2">{label}</h3>
      <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
        {children}
      </div>
    </div>
  );
}

function Toggle({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  return (
    <div 
      onClick={onToggle}
      className={`w-[52px] h-[32px] flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
        isOn ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
      }`}
    >
      <motion.div
        className="w-6 h-6 bg-white rounded-full shadow-md"
        animate={{ x: isOn ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </div>
  );
}

function AlertModal({ isOpen, onClose, title, content }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
        <div className="p-6">
          <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
          {content && <p className="text-[#8E8E93] text-sm">{content}</p>}
        </div>
        <div className="border-t border-[#3A3A3C] h-12">
          <button onClick={onClose} className="w-full h-full text-brand-DEFAULT font-bold text-[16px] hover:bg-[#2C2C2E]">확인</button>
        </div>
      </motion.div>
    </div>
  );
}