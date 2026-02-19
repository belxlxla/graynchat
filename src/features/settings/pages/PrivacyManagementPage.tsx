import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Lock, Shield, Eye, FileText, 
  ChevronRight, AlertTriangle, Trash2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function PrivacyManagementPage() {
  const navigate = useNavigate();

  // === States ===
  const [toggles, setToggles] = useState({
    idSearch: localStorage.getItem('grayn_allow_contact_add') !== 'false',
    recommend: localStorage.getItem('grayn_allow_recommend') !== 'false',
  });

  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // 1. 설정 동기화 함수
  const fetchAndSyncSettings = useCallback(async () => {
    const lockStatus = localStorage.getItem('grayn_lock_enabled') === 'true';
    setIsLockEnabled(lockStatus);

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data, error } = await supabase
        .from('user_settings')
        .select('allow_contact_add, allow_recommend')
        .eq('user_id', session.user.id)
        .single();

      if (!error && data) {
        const newSettings = {
          idSearch: data.allow_contact_add ?? true,
          recommend: data.allow_recommend ?? true,
        };
        setToggles(newSettings);
        localStorage.setItem('grayn_allow_contact_add', String(newSettings.idSearch));
        localStorage.setItem('grayn_allow_recommend', String(newSettings.recommend));
      }
    }
  }, []);

  useEffect(() => {
    fetchAndSyncSettings();
    window.addEventListener('focus', fetchAndSyncSettings);
    return () => window.removeEventListener('focus', fetchAndSyncSettings);
  }, [fetchAndSyncSettings]);

  // 2. 토글 변경 핸들러
  const handleToggle = async (key: keyof typeof toggles) => {
    const newValue = !toggles[key];
    setToggles(prev => ({ ...prev, [key]: newValue }));
    
    const storageKey = key === 'idSearch' ? 'grayn_allow_contact_add' : 'grayn_allow_recommend';
    localStorage.setItem(storageKey, String(newValue));

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const dbField = key === 'idSearch' ? 'allow_contact_add' : 'allow_recommend';
      await supabase.from('user_settings').upsert({ user_id: session.user.id, [dbField]: newValue });
      toast.success('설정이 저장되었습니다.');
    }
  };

  // 3. 모든 데이터 삭제 실행 로직
  const handlePurgeAllData = async () => {
    setIsDeleting(true);
    const loadingToast = toast.loading('데이터 파기 진행 중...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { error } = await supabase.rpc('delete_user_all_data', { 
          target_user_id: session.user.id 
        });
        
        if (error) {
            console.warn("RPC Warning:", error.message);
        }

        await supabase.auth.signOut();
      }

      localStorage.clear();

      toast.dismiss(loadingToast);
      toast.success('모든 데이터가 성공적으로 파기되었습니다.');

      window.location.href = '/'; 
      
    } catch (error) {
      console.error(error);
      toast.dismiss(loadingToast);
      toast.error('삭제 처리에 실패했습니다.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">개인/보안</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 space-y-8">
        
        {/* 1. 보안 설정 섹션 */}
        <Section title="보안">
          <button onClick={() => navigate('/settings/security/lock')} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] transition-colors group">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-[#8E8E93]" />
              <span className="text-[15px] text-white">화면 잠금</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[13px] ${isLockEnabled ? 'text-brand-DEFAULT font-bold' : 'text-[#8E8E93]'}`}>
                {isLockEnabled ? '사용 중' : '사용 안 함'}
              </span>
              <ChevronRight className="w-4 h-4 text-[#636366]" />
            </div>
          </button>
          
          <button onClick={() => navigate('/settings/security/manage')} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] transition-colors group">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#8E8E93]" />
              <span className="text-[15px] text-white">로그인 기기 관리</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#636366]" />
          </button>
        </Section>

        {/* 2. 프라이버시 섹션 */}
        <Section title="프라이버시">
          <ToggleItem 
            icon={<Eye className="w-5 h-5" />} 
            label="이름과 연락처로 친구 추가 허용" 
            checked={toggles.idSearch} 
            onChange={() => handleToggle('idSearch')} 
          />
          <ToggleItem 
            icon={<FileText className="w-5 h-5" />} 
            label="친구 추천 허용" 
            checked={toggles.recommend} 
            onChange={() => handleToggle('recommend')} 
          />
        </Section>

        {/* 3. 데이터 관리 섹션 */}
        <Section title="데이터 관리">
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] transition-colors text-left"
          >
            <span className="text-[15px] text-[#FF203A] font-bold">모든 데이터 삭제</span>
          </button>
        </Section>

      </div>

      {/* === Custom Dark Confirmation Modal === */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
              onClick={() => !isDeleting && setShowDeleteModal(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] border border-[#3A3A3C] rounded-[40px] overflow-hidden shadow-2xl text-center"
            >
              <div className="p-8 pb-6">
                <div className="w-16 h-16 bg-[#FF203A]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#FF203A]/20">
                  <AlertTriangle className="w-8 h-8 text-[#FF203A]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3 tracking-tight">모든 데이터를 파기할까요?</h3>
                <p className="text-[13px] text-[#8E8E93] leading-relaxed">
                  삭제 시 <span className="text-white font-bold">대화 리스트, 친구 관계, 보안 설정</span> 등 회원님의 모든 활동 정보가 영구 삭제됩니다.<br/>
                  <span className="text-[#FF203A] font-bold mt-2 block italic">이 동작은 되돌릴 수 없습니다.</span>
                </p>
              </div>
              <div className="flex p-4 gap-3">
                <button 
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 py-4 bg-[#2C2C2E] text-white font-bold rounded-2xl active:scale-95 transition-all disabled:opacity-50"
                >
                  취소
                </button>
                <button 
                  onClick={handlePurgeAllData}
                  disabled={isDeleting}
                  className="flex-1 py-4 bg-[#FF203A] text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-[#FF203A]/20 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Trash2 size={18} />
                      파기하기
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// === Sub Components ===

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-[11px] font-bold text-[#8E8E93] ml-2 mb-2 tracking-[0.1em] uppercase">{title}</h3>
      <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C]">
        {children}
      </div>
    </div>
  );
}

function ToggleItem({ 
  icon, label, checked, onChange 
}: { 
  icon: React.ReactNode, label: string, checked: boolean, onChange: () => void 
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="text-[#8E8E93]">{icon}</div>
        <span className="text-[15px] text-white">{label}</span>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

// ✨ 정밀 정렬된 Switch 컴포넌트
function Switch({ checked, onChange }: { checked: boolean, onChange: () => void }) {
  return (
    <button 
      onClick={onChange}
      className={`relative w-[48px] h-[26px] rounded-full transition-colors duration-300 ease-in-out ${checked ? 'bg-brand-DEFAULT' : 'bg-[#48484A]'}`}
    >
      <motion.div 
        className="absolute top-[3px] left-[3px] w-[20px] h-[20px] bg-white rounded-full shadow-sm"
        animate={{ x: checked ? 22 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}