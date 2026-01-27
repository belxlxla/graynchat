import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ShieldCheck, CheckCircle2, ChevronRight, Check } from 'lucide-react';

// === [Mock Data] ===
const CONSENT_LIST = [
  { id: 1, title: '[필수] 그레인 이용약관', date: '2024.01.15' },
  { id: 2, title: '[필수] 개인정보 수집 및 이용 동의', date: '2024.01.15' },
  { id: 3, title: '[필수] 프로필 정보(닉네임/사진) 제공', date: '2024.01.15' },
  { id: 4, title: '[필수] 휴대전화 번호 인증 및 저장', date: '2024.01.15' },
  { id: 5, title: '[선택] 마케팅 정보 수신 동의', date: null },
];

export default function PrivacyManagementPage() {
  const navigate = useNavigate();

  // === States ===
  // view: 'main' (리스트 화면) | 'warning' (탈퇴 유의사항 화면)
  const [view, setView] = useState<'main' | 'warning'>('main');
  const [isChecked, setIsChecked] = useState(false); // 유의사항 동의 체크
  
  // 모달 상태
  const [showConfirmModal, setShowConfirmModal] = useState(false); // 정말 탈퇴하시겠어요?
  const [showSuccessModal, setShowSuccessModal] = useState(false); // 탈퇴 완료

  // === Handlers ===

  const handleBack = () => {
    if (view === 'warning') {
      setView('main');
      setIsChecked(false);
    } else {
      navigate(-1);
    }
  };

  const handleInitialWithdrawClick = () => {
    setView('warning');
  };

  const handleConfirmWithdraw = () => {
    setShowConfirmModal(false);
    setShowSuccessModal(true);
  };

  const handleFinalSuccess = () => {
    // 로컬 스토리지 데이터 삭제 (로그인 정보 등)
    localStorage.removeItem('login_provider');
    localStorage.removeItem('grayn_contact_permission');
    
    // 앱 새로고침 -> 스플래시 화면으로 이동
    window.location.reload();
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === Header === */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button 
          onClick={handleBack} 
          className="p-2 text-white hover:text-brand-DEFAULT transition-colors"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">
          {view === 'warning' ? '회원 탈퇴' : '개인정보 관리'}
        </h1>
      </header>

      {/* === Content === */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        {/* VIEW 1: 메인 (개인정보 관리 리스트) */}
        {view === 'main' && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            {/* 1. Hero Section */}
            <div className="px-5 pt-6 pb-8">
              <div className="w-full bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E] rounded-3xl p-6 border border-[#3A3A3C] relative overflow-hidden shadow-lg">
                <div className="relative z-10">
                  <div className="w-12 h-12 bg-brand-DEFAULT/20 rounded-2xl flex items-center justify-center mb-4 text-brand-DEFAULT">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h2 className="text-xl font-bold leading-snug mb-2 text-white">
                    그레인은 이용자의<br/>
                    프라이버시 보호를<br/>
                    최우선으로 합니다.
                  </h2>
                  <p className="text-xs text-[#8E8E93] leading-relaxed">
                    수집된 개인정보는 투명하게 공개되며,<br/>
                    안전한 보안 시스템으로 철저히 관리됩니다.
                  </p>
                </div>
                <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-brand-DEFAULT/10 rounded-full blur-2xl" />
              </div>
            </div>

            {/* 2. Consent List */}
            <div className="px-5 space-y-3 mb-12">
              <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2">동의 정보 (필수/선택)</h3>
              <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C]">
                {CONSENT_LIST.map((item) => (
                  <div key={item.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className={`mt-0.5 ${item.date ? 'text-brand-DEFAULT' : 'text-[#636366]'}`}>
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                      <div>
                        <p className={`text-[14px] ${item.date ? 'text-white' : 'text-[#636366]'}`}>
                          {item.title}
                        </p>
                        {item.date && (
                          <p className="text-[11px] text-[#8E8E93] mt-0.5">
                            동의일: {item.date}
                          </p>
                        )}
                      </div>
                    </div>
                    {item.date && (
                      <button className="text-[#8E8E93]">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 3. Withdraw Link */}
            <div className="px-5 flex justify-center pb-8">
              <button 
                onClick={handleInitialWithdrawClick}
                className="text-[13px] text-[#636366] underline underline-offset-4 decoration-[#3A3A3C] hover:text-[#8E8E93] transition-colors"
              >
                그레인 탈퇴
              </button>
            </div>
          </motion.div>
        )}

        {/* VIEW 2: 탈퇴 유의사항 화면 */}
        {view === 'warning' && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            className="px-5 pt-6"
          >
            <h2 className="text-xl font-bold text-white mb-6">
              그레인을 탈퇴하면,
            </h2>

            <div className="space-y-6 text-[14px] text-[#E5E5EA] leading-relaxed mb-10">
              <p>
                - 내 프로필, 친구 목록 전체 (즐겨찾기, 차단을 포함한 모든 친구), 대화 내용, 운영중인 그룹채팅방 등 그 외 사용자가 설정한 모든 정보가 사라지고 복구가 불가능합니다.
              </p>
              <p>
                - 참여 중인 모든 대화방에서 나가게 되고, 대화방에서 주고받은 사진이나 파일 등 모든 정보가 즉시 삭제됩니다. 중요한 정보는 탈퇴 전에 저장해 주세요.
              </p>
              <p>
                - 그레인에서 추후 서비스를 구독한 경우 정기결제 해지 전 까지 구독한 플랫폼은 계속 이용하실 수 있습니다.
              </p>
              <p>
                - 그레인 서비스를 구독 중이신 경우, 그레인을 탈퇴하더라도 정기결제가 계속 진행됩니다. 정기결제를 중단하시려면 직접 해지를 진행해 주세요
              </p>
              <p className="text-[#EC5022]">
                - 내가 작성 및 생성한 내 프로필의 데이터가 모두 사라지고 복구 및 백업이 불가하오니 백업을 원하시는 경우 반드시 설정 페이지의 백업을 진행해주시기 바랍니다. 탈퇴 직후 모든 데이터는 사라지고 복구 및 백업이 불가능합니다.
              </p>
            </div>

            <div className="bg-[#2C2C2E] p-4 rounded-xl mb-8 flex items-start gap-3 cursor-pointer" onClick={() => setIsChecked(!isChecked)}>
              <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${isChecked ? 'bg-brand-DEFAULT border-brand-DEFAULT' : 'border-[#636366]'}`}>
                {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <p className="text-sm font-bold text-white select-none">
                위 유의사항을 모두 확인하였고, 탈퇴를 진행합니다.
              </p>
            </div>

            <button 
              onClick={() => setShowConfirmModal(true)}
              disabled={!isChecked}
              className={`w-full h-14 rounded-2xl font-bold text-base transition-all ${
                isChecked 
                  ? 'bg-[#EC5022] text-white shadow-lg shadow-red-900/20' 
                  : 'bg-[#3A3A3C] text-[#636366] cursor-not-allowed'
              }`}
            >
              탈퇴하기
            </button>
          </motion.div>
        )}

      </div>

      {/* === Custom Modals === */}

      {/* 1. 탈퇴 확인 모달 */}
      <CustomConfirmModal 
        isOpen={showConfirmModal}
        title="정말 그레인을 탈퇴하시겠어요?"
        content="탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다."
        confirmText="탈퇴하기"
        cancelText="취소"
        isDanger
        onConfirm={handleConfirmWithdraw}
        onCancel={() => setShowConfirmModal(false)}
      />

      {/* 2. 탈퇴 완료 모달 */}
      <CustomAlertModal 
        isOpen={showSuccessModal}
        title="탈퇴가 완료되었습니다."
        content="그동안 그레인을 이용해 주셔서 감사합니다."
        buttonText="확인"
        onConfirm={handleFinalSuccess}
      />

    </div>
  );
}

// === [Sub Components: Custom Modals] ===

function CustomConfirmModal({ 
  isOpen, title, content, confirmText, cancelText, isDanger, onConfirm, onCancel 
}: { 
  isOpen: boolean; title: string; content?: string; confirmText: string; cancelText: string; isDanger?: boolean; onConfirm: () => void; onCancel: () => void; 
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
        <div className="p-6">
          <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
          {content && <p className="text-[#8E8E93] text-sm">{content}</p>}
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button onClick={onCancel} className="flex-1 text-[#8E8E93] font-medium text-[16px] hover:bg-[#2C2C2E] transition-colors">
            {cancelText}
          </button>
          <div className="w-[1px] bg-[#3A3A3C]" />
          <button onClick={onConfirm} className={`flex-1 font-bold text-[16px] hover:bg-[#2C2C2E] transition-colors ${isDanger ? 'text-[#EC5022]' : 'text-brand-DEFAULT'}`}>
            {confirmText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function CustomAlertModal({ 
  isOpen, title, content, buttonText, onConfirm 
}: { 
  isOpen: boolean; title: string; content?: string; buttonText: string; onConfirm: () => void; 
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
        <div className="p-6">
          <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
          {content && <p className="text-[#8E8E93] text-sm">{content}</p>}
        </div>
        <div className="border-t border-[#3A3A3C] h-12">
          <button onClick={onConfirm} className="w-full h-full text-brand-DEFAULT font-bold text-[16px] hover:bg-[#2C2C2E] transition-colors">
            {buttonText}
          </button>
        </div>
      </motion.div>
    </div>
  );
}