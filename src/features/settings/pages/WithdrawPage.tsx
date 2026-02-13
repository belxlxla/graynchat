import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, AlertTriangle, CheckCircle2, Circle, Heart, 
  Lock, XCircle, ArrowRight, ArrowLeft, Loader2, Eye, EyeOff,
  Frown, Shield, HelpCircle, RefreshCw, Moon, Lightbulb, FileEdit,
  Trash2, Users, FolderOpen, CreditCard, AlertOctagon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

type Step = 1 | 2 | 3;

const WITHDRAW_REASONS = [
  { id: 'not_useful', label: '서비스가 유용하지 않아요', icon: Frown },
  { id: 'privacy_concern', label: '개인정보 보호가 걱정돼요', icon: Shield },
  { id: 'too_complex', label: '사용법이 어려워요', icon: HelpCircle },
  { id: 'switching_service', label: '다른 서비스로 옮겨요', icon: RefreshCw },
  { id: 'temporary_break', label: '잠시 쉬고 싶어요', icon: Moon },
  { id: 'dissatisfied_feature', label: '원하는 기능이 없어요', icon: Lightbulb },
  { id: 'other', label: '기타 (직접 입력)', icon: FileEdit },
] as const;

export default function WithdrawPage() {
  const navigate = useNavigate();
  
  // Step 관리
  const [currentStep, setCurrentStep] = useState<Step>(1);
  
  // Step 1: 탈퇴 사유
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  
  // Step 2: 주의사항 확인
  const [checks, setChecks] = useState({ 
    data: false, 
    friend: false, 
    files: false,
    refund: false,
    permanent: false,
  });
  
  // Step 3: 최종 확인
  const [confirmText, setConfirmText] = useState('');
  const [password, setPassword] = useState('');
  
  // 상태
  const [isProcessing, setIsProcessing] = useState(false);
  const [showFinalConfirmModal, setShowFinalConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 유효성 검사
  const isStep1Valid = selectedReason !== '' && (selectedReason !== 'other' || otherReason.trim().length >= 10);
  const isStep2Valid = Object.values(checks).every(v => v);
  const isStep3Valid = confirmText === '탈퇴하겠습니다' && password.length >= 8;

  // Step 1 다음
  const handleStep1Next = () => {
    if (!isStep1Valid) {
      if (selectedReason === '') {
        toast.error('탈퇴 사유를 선택해주세요.');
      } else if (selectedReason === 'other' && otherReason.trim().length < 10) {
        toast.error('사유를 10자 이상 입력해주세요.');
      }
      return;
    }
    setCurrentStep(2);
  };

  // Step 2 다음
  const handleStep2Next = () => {
    if (!isStep2Valid) {
      toast.error('모든 항목을 확인해주세요.');
      return;
    }
    setCurrentStep(3);
  };

  // Step 3 - 최종 확인 모달 표시
  const handleStep3Next = () => {
    if (!isStep3Valid) {
      if (confirmText !== '탈퇴하겠습니다') {
        toast.error('확인 문구를 정확히 입력해주세요.');
      } else if (password.length < 8) {
        toast.error('비밀번호를 입력해주세요.');
      }
      return;
    }
    setShowFinalConfirmModal(true);
  };

  // 최종 탈퇴 처리
  const handleWithdraw = async () => {
    if (!isStep3Valid || isProcessing) return;
    
    setIsProcessing(true);

    try {
      // 1. 비밀번호 확인
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user?.email) {
        throw new Error('로그인 세션을 찾을 수 없습니다.');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: password,
      });

      if (signInError) {
        toast.error('비밀번호가 일치하지 않습니다.');
        setIsProcessing(false);
        setShowFinalConfirmModal(false);
        return;
      }

      // 2. 탈퇴 사유 저장
      const reasonText = selectedReason === 'other' 
        ? otherReason 
        : WITHDRAW_REASONS.find(r => r.id === selectedReason)?.label || '';

      await supabase.from('withdrawal_reasons').insert({
        user_id: session.user.id,
        reason_code: selectedReason,
        reason_text: reasonText,
        additional_feedback: selectedReason === 'other' ? otherReason : null,
      });

      // 3. 계정 삭제 RPC 호출
      const { error: rpcError } = await supabase.rpc('delete_user_account');
      
      if (rpcError) {
        console.error('RPC Error:', rpcError);
        toast.error('탈퇴 처리 중 오류가 발생했습니다.');
        setIsProcessing(false);
        setShowFinalConfirmModal(false);
        return;
      }

      // 4. 로그아웃
      await supabase.auth.signOut();
      
      // 5. 성공 모달 표시
      setShowFinalConfirmModal(false);
      setShowSuccessModal(true);

    } catch (err: any) {
      console.error('Withdraw Error:', err);
      toast.error(err.message || '연결 상태를 확인해 주세요.');
      setIsProcessing(false);
      setShowFinalConfirmModal(false);
    }
  };

  const handleFinalExit = () => {
    window.location.href = '/';
  };

  const progressPercentage = (currentStep / 3) * 100;

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0A0A0A] text-white overflow-hidden font-sans">
      {/* 헤더 */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
        <button 
          onClick={() => {
            if (currentStep > 1) {
              setCurrentStep((currentStep - 1) as Step);
            } else {
              navigate(-1);
            }
          }} 
          className="p-2 text-white"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">회원 탈퇴</h1>
      </header>

      {/* 진행 바 */}
      <div className="h-1 bg-[#1C1C1E] shrink-0">
        <motion.div 
          className="h-full bg-gradient-to-r from-[#FF203A] to-[#FF5555]"
          initial={{ width: '0%' }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AnimatePresence mode="wait">
          {currentStep === 1 && (
            <Step1Content 
              key="step1"
              selectedReason={selectedReason}
              setSelectedReason={setSelectedReason}
              otherReason={otherReason}
              setOtherReason={setOtherReason}
              onNext={handleStep1Next}
              isValid={isStep1Valid}
            />
          )}

          {currentStep === 2 && (
            <Step2Content 
              key="step2"
              checks={checks}
              setChecks={setChecks}
              onNext={handleStep2Next}
              onBack={() => setCurrentStep(1)}
              isValid={isStep2Valid}
            />
          )}

          {currentStep === 3 && (
            <Step3Content 
              key="step3"
              confirmText={confirmText}
              setConfirmText={setConfirmText}
              password={password}
              setPassword={setPassword}
              onNext={handleStep3Next}
              onBack={() => setCurrentStep(2)}
              isValid={isStep3Valid}
            />
          )}
        </AnimatePresence>
      </div>

      {/* 최종 확인 모달 */}
      <AnimatePresence>
        {showFinalConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-[340px] bg-gradient-to-b from-[#1C1C1E] to-[#0A0A0A] border border-[#FF203A]/30 rounded-[32px] p-8 text-center shadow-2xl shadow-[#FF203A]/20"
            >
              <div className="w-20 h-20 bg-[#FF203A]/10 rounded-full flex items-center justify-center mx-auto mb-6 border-2 border-[#FF203A]/30">
                <XCircle className="w-10 h-10 text-[#FF203A]" />
              </div>
              
              <h3 className="text-2xl font-black text-white mb-3">정말 탈퇴하시겠습니까?</h3>
              <p className="text-sm text-[#8E8E93] leading-relaxed mb-8">
                이 작업은 되돌릴 수 없으며,<br/>
                모든 데이터가 영구적으로 삭제됩니다.
              </p>

              <div className="space-y-3">
                <button 
                  onClick={handleWithdraw}
                  disabled={isProcessing}
                  className="w-full py-4 bg-[#FF203A] hover:bg-[#FF3A4A] text-white font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      처리 중...
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5" />
                      네, 탈퇴하겠습니다
                    </>
                  )}
                </button>

                <button 
                  onClick={() => setShowFinalConfirmModal(false)}
                  disabled={isProcessing}
                  className="w-full py-4 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white font-bold rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                >
                  취소
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 성공 모달 */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="absolute inset-0 bg-black/95 backdrop-blur-xl" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              className="relative z-10 w-full max-w-[340px] bg-gradient-to-b from-[#1C1C1E] to-[#0A0A0A] border border-[#2C2C2E] rounded-[40px] p-10 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center mx-auto mb-8 border-2 border-brand-DEFAULT/30">
                <Heart className="w-10 h-10 text-brand-DEFAULT" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4">탈퇴가 완료되었습니다</h3>
              <p className="text-sm text-[#8E8E93] leading-relaxed mb-10">
                그동안 그레인을 이용해 주셔서 감사합니다.<br/>
                더 나은 서비스로 다시 만날 날을 기다리겠습니다.
              </p>
              <button 
                onClick={handleFinalExit}
                className="w-full py-5 bg-brand-DEFAULT hover:bg-brand-hover text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg"
              >
                확인
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ==================== Step 1: 탈퇴 사유 선택 ====================
function Step1Content({ 
  selectedReason, 
  setSelectedReason, 
  otherReason, 
  setOtherReason,
  onNext,
  isValid,
}: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }}
      className="px-6 py-8"
    >
      <div className="mb-10">
        <div className="w-16 h-16 bg-[#FF203A]/10 rounded-2xl flex items-center justify-center mb-6 border-2 border-[#FF203A]/20">
          <AlertTriangle className="w-8 h-8 text-[#FF203A]" />
        </div>
        <h2 className="text-3xl font-black tracking-tight mb-3 bg-gradient-to-r from-white to-[#8E8E93] bg-clip-text text-transparent">
          떠나시는 이유를<br/>알려주세요
        </h2>
        <p className="text-[#8E8E93] text-sm leading-relaxed">
          더 나은 서비스를 만들기 위해<br/>
          솔직한 의견을 들려주세요.
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {WITHDRAW_REASONS.map((reason) => {
          const IconComponent = reason.icon;
          return (
            <motion.button
              key={reason.id}
              type="button"
              onClick={() => setSelectedReason(reason.id)}
              whileTap={{ scale: 0.98 }}
              className={`w-full p-4 rounded-2xl border-2 transition-all text-left ${
                selectedReason === reason.id
                  ? 'bg-[#FF203A]/10 border-[#FF203A] shadow-lg shadow-[#FF203A]/10'
                  : 'bg-[#1C1C1E] border-[#2C2C2E] hover:border-[#3A3A3C]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  selectedReason === reason.id
                    ? 'bg-[#FF203A]/20'
                    : 'bg-[#2C2C2E]'
                }`}>
                  <IconComponent className={`w-5 h-5 ${
                    selectedReason === reason.id ? 'text-[#FF203A]' : 'text-[#8E8E93]'
                  }`} />
                </div>
                <span className={`text-sm font-medium ${
                  selectedReason === reason.id ? 'text-white' : 'text-[#8E8E93]'
                }`}>
                  {reason.label}
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* 기타 사유 입력 */}
      <AnimatePresence>
        {selectedReason === 'other' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-8"
          >
            <label className="text-xs font-bold text-[#8E8E93] ml-1 mb-2 block">
              자세한 사유를 입력해주세요 (최소 10자)
            </label>
            <textarea
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              placeholder="탈퇴하시는 이유를 구체적으로 알려주세요..."
              className="w-full h-32 bg-[#1C1C1E] border-2 border-[#2C2C2E] rounded-2xl px-4 py-3 text-white placeholder-[#48484A] focus:outline-none focus:border-[#FF203A] transition-all resize-none"
              maxLength={500}
            />
            <p className="text-xs text-[#636366] mt-2 text-right">
              {otherReason.length} / 500
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onNext}
        disabled={!isValid}
        className={`w-full py-5 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
          isValid
            ? 'bg-[#FF203A] hover:bg-[#FF3A4A] text-white shadow-lg shadow-[#FF203A]/20 active:scale-95'
            : 'bg-[#2C2C2E] text-[#48484A] cursor-not-allowed'
        }`}
      >
        다음 단계
        <ArrowRight className="w-5 h-5" />
      </button>
    </motion.div>
  );
}

// ==================== Step 2: 주의사항 확인 ====================
function Step2Content({ checks, setChecks, onNext, onBack, isValid }: any) {
  const warnings = [
    { 
      key: 'data', 
      label: '모든 개인 데이터가 즉시 삭제됩니다', 
      desc: '프로필, 설정, 계정 기록 등 그레인에 저장된 모든 정보가 영구적으로 파기됩니다.',
      icon: Trash2
    },
    { 
      key: 'friend', 
      label: '친구 목록에서 내 정보가 사라집니다', 
      desc: '상대방의 친구 목록에서 회원님이 삭제되며, 더 이상 대화를 주고받을 수 없습니다.',
      icon: Users
    },
    { 
      key: 'files', 
      label: '공유한 사진과 파일이 모두 삭제됩니다', 
      desc: '채팅방에서 공유했던 모든 미디어 파일은 서버에서 영구 삭제되어 다시 볼 수 없습니다.',
      icon: FolderOpen
    },
    { 
      key: 'refund', 
      label: '환불 및 복구가 불가능합니다', 
      desc: '유료 서비스 이용 중이더라도 환불되지 않으며, 한 번 삭제된 계정은 복구할 수 없습니다.',
      icon: CreditCard
    },
    { 
      key: 'permanent', 
      label: '이 작업은 되돌릴 수 없습니다', 
      desc: '탈퇴 후에는 동일한 이메일로 재가입할 수 없으며, 모든 데이터는 즉시 파기됩니다.',
      icon: AlertOctagon
    },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }}
      className="px-6 py-8"
    >
      <div className="mb-10">
        <div className="w-16 h-16 bg-[#FF203A]/10 rounded-2xl flex items-center justify-center mb-6 border-2 border-[#FF203A]/20">
          <Lock className="w-8 h-8 text-[#FF203A]" />
        </div>
        <h2 className="text-3xl font-black tracking-tight mb-3 bg-gradient-to-r from-white to-[#8E8E93] bg-clip-text text-transparent">
          주의사항을<br/>확인해주세요
        </h2>
        <p className="text-[#8E8E93] text-sm leading-relaxed">
          탈퇴하기 전 반드시 확인해야 할<br/>
          중요한 사항들입니다.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        {warnings.map((warning) => (
          <CheckItem 
            key={warning.key}
            label={warning.label}
            desc={warning.desc}
            IconComponent={warning.icon}
            checked={checks[warning.key as keyof typeof checks]}
            onClick={() => setChecks({ ...checks, [warning.key]: !checks[warning.key as keyof typeof checks] })}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-5 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          이전
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className={`flex-1 py-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
            isValid
              ? 'bg-[#FF203A] hover:bg-[#FF3A4A] text-white shadow-lg shadow-[#FF203A]/20 active:scale-95'
              : 'bg-[#2C2C2E] text-[#48484A] cursor-not-allowed'
          }`}
        >
          다음 단계
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// ==================== Step 3: 최종 확인 ====================
function Step3Content({ confirmText, setConfirmText, password, setPassword, onNext, onBack, isValid }: any) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      exit={{ opacity: 0, x: -20 }}
      className="px-6 py-8"
    >
      <div className="mb-10">
        <div className="w-16 h-16 bg-[#FF203A]/10 rounded-2xl flex items-center justify-center mb-6 border-2 border-[#FF203A]/20">
          <XCircle className="w-8 h-8 text-[#FF203A]" />
        </div>
        <h2 className="text-3xl font-black tracking-tight mb-3 bg-gradient-to-r from-white to-[#8E8E93] bg-clip-text text-transparent">
          마지막<br/>확인 단계입니다
        </h2>
        <p className="text-[#8E8E93] text-sm leading-relaxed">
          본인 확인을 위해<br/>
          아래 정보를 정확히 입력해주세요.
        </p>
      </div>

      <div className="space-y-6 mb-8">
        {/* 확인 문구 입력 */}
        <div>
          <label className="text-xs font-bold text-[#8E8E93] ml-1 mb-2 block">
            다음 문구를 정확히 입력해주세요
          </label>
          <div className="bg-[#1C1C1E] border-2 border-[#2C2C2E] rounded-2xl p-5 text-center mb-4">
            <h4 className="text-white font-black text-xl tracking-tight">
              탈퇴하겠습니다
            </h4>
          </div>
          <input 
            type="text" 
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="위 문구를 입력하세요"
            className={`w-full bg-[#1C1C1E] border-2 rounded-2xl px-4 py-4 text-center text-white placeholder-[#48484A] focus:outline-none transition-all ${
              confirmText === '탈퇴하겠습니다'
                ? 'border-green-500 focus:border-green-500'
                : 'border-[#2C2C2E] focus:border-[#FF203A]'
            }`}
          />
        </div>

        {/* 비밀번호 입력 */}
        <div>
          <label className="text-xs font-bold text-[#8E8E93] ml-1 mb-2 block">
            현재 비밀번호 입력
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#636366]" />
            <input 
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full bg-[#1C1C1E] border-2 border-[#2C2C2E] rounded-2xl pl-12 pr-12 py-4 text-white placeholder-[#48484A] focus:outline-none focus:border-[#FF203A] transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#636366] hover:text-white transition-colors"
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="flex-1 py-5 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white font-bold rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-5 h-5" />
          이전
        </button>
        <button
          onClick={onNext}
          disabled={!isValid}
          className={`flex-1 py-5 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
            isValid
              ? 'bg-[#FF203A] hover:bg-[#FF3A4A] text-white shadow-lg shadow-[#FF203A]/20 active:scale-95'
              : 'bg-[#2C2C2E] text-[#48484A] cursor-not-allowed'
          }`}
        >
          탈퇴하기
          <XCircle className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
}

// ==================== 체크 아이템 컴포넌트 ====================
function CheckItem({ label, desc, IconComponent, checked, onClick }: any) {
  return (
    <motion.div 
      onClick={onClick} 
      whileTap={{ scale: 0.98 }}
      className={`p-5 rounded-2xl border-2 transition-all cursor-pointer ${
        checked 
          ? 'bg-white/5 border-[#FF203A]/50 shadow-lg shadow-[#FF203A]/10' 
          : 'bg-[#1C1C1E] border-[#2C2C2E] hover:border-[#3A3A3C]'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          checked ? 'bg-[#FF203A]/20' : 'bg-[#2C2C2E]'
        }`}>
          <IconComponent className={`w-5 h-5 ${
            checked ? 'text-[#FF203A]' : 'text-[#636366]'
          }`} />
        </div>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h4 className={`text-sm font-bold ${checked ? 'text-white' : 'text-[#8E8E93]'}`}>
              {label}
            </h4>
            <div className="shrink-0 mt-0.5">
              {checked ? (
                <CheckCircle2 className="w-5 h-5 text-[#FF203A]" />
              ) : (
                <Circle className="w-5 h-5 text-[#48484A]" />
              )}
            </div>
          </div>
          <p className="text-xs text-[#636366] leading-relaxed">
            {desc}
          </p>
        </div>
      </div>
    </motion.div>
  );
}