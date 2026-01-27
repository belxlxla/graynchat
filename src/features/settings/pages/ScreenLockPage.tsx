import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Lock, Fingerprint, KeyRound, Delete, X, ScanFace } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ScreenLockPage() {
  const navigate = useNavigate();

  // === States ===
  const [isLockEnabled, setIsLockEnabled] = useState(false);
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);

  // 모달 상태 관리
  const [showPinModal, setShowPinModal] = useState(false); // 암호 입력 모달
  const [showDisableConfirm, setShowDisableConfirm] = useState(false); // 잠금 해제 확인 모달
  const [showSuccessModal, setShowSuccessModal] = useState(false); // 설정/변경 완료 모달
  const [showBiometricModal, setShowBiometricModal] = useState(false); // 생체인증 요청 모달

  // 암호 설정 상태
  const [pinMode, setPinMode] = useState<'setup' | 'change'>('setup'); // '설정' 모드 vs '변경' 모드
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  
  // 완료 모달 텍스트 관리
  const [successText, setSuccessText] = useState({ title: '', content: '' });

  // === Handlers ===

  // 1. 화면 잠금 토글 핸들러
  const handleToggleLock = () => {
    if (isLockEnabled) {
      setShowDisableConfirm(true);
    } else {
      setPinMode('setup'); // 모드: 설정
      setPinStep('create');
      setFirstPin('');
      setShowPinModal(true);
    }
  };

  // 2. ✨ 암호 변경 핸들러
  const handleChangePassword = () => {
    if (!isLockEnabled) return toast.error('화면 잠금을 먼저 설정해주세요.');
    
    setPinMode('change'); // 모드: 변경
    setPinStep('create');
    setFirstPin('');
    setShowPinModal(true);
  };

  // 3. 암호 입력 완료 핸들러 (통합)
  const handlePinComplete = (pin: string) => {
    if (pinStep === 'create') {
      setFirstPin(pin);
      setPinStep('confirm');
    } else {
      if (pin === firstPin) {
        // 암호 일치 -> 성공 처리
        setShowPinModal(false);
        
        if (pinMode === 'setup') {
          setIsLockEnabled(true);
          setSuccessText({ title: '설정 완료', content: '화면 잠금 비밀번호가 설정되었습니다.' });
        } else {
          // 변경 모드일 때
          setSuccessText({ title: '변경 완료', content: '화면 잠금 비밀번호가 변경되었습니다.' });
        }
        
        setShowSuccessModal(true);
      } else {
        toast.error('암호가 일치하지 않습니다. 처음부터 다시 입력해주세요.');
        setPinStep('create');
        setFirstPin('');
      }
    }
  };

  // 4. 잠금 해제 확인 핸들러
  const confirmDisable = () => {
    setIsLockEnabled(false);
    setIsBiometricEnabled(false);
    setShowDisableConfirm(false);
    toast.success('화면 잠금이 해제되었습니다.');
  };

  // 5. 생체인증 토글 핸들러
  const toggleBiometric = () => {
    if (!isLockEnabled) return toast.error('화면 잠금을 먼저 설정해주세요.');

    if (isBiometricEnabled) {
      setIsBiometricEnabled(false);
      toast.success('생체인증이 비활성화되었습니다.');
    } else {
      setShowBiometricModal(true);
    }
  };

  // 6. 생체인증 성공 핸들러
  const handleBiometricSuccess = () => {
    setIsBiometricEnabled(true);
    setShowBiometricModal(false);
    toast.success('생체인증이 활성화되었습니다.');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === Header === */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">화면 잠금</h1>
      </header>

      {/* === Content === */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pt-4">
        <div className="px-5 space-y-6">
          
          <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
            
            {/* 화면 잠금 토글 */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-[#8E8E93]" />
                <span className="text-[15px] text-white">화면 잠금</span>
              </div>
              <div 
                onClick={handleToggleLock}
                className={`w-[52px] h-[32px] flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                  isLockEnabled ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
                }`}
              >
                <motion.div
                  className="w-6 h-6 bg-white rounded-full shadow-md"
                  animate={{ x: isLockEnabled ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </div>
            </div>

            <div className="h-[1px] bg-[#3A3A3C] mx-4" />

            {/* 생체인증 토글 */}
            <div className={`flex items-center justify-between px-5 py-4 ${!isLockEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center gap-3">
                <Fingerprint className="w-5 h-5 text-[#8E8E93]" />
                <span className="text-[15px] text-white">생체인증 (FaceID/TouchID)</span>
              </div>
              <div 
                onClick={toggleBiometric}
                className={`w-[52px] h-[32px] flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                  isBiometricEnabled ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
                }`}
              >
                <motion.div
                  className="w-6 h-6 bg-white rounded-full shadow-md"
                  animate={{ x: isBiometricEnabled ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </div>
            </div>

            <div className="h-[1px] bg-[#3A3A3C] mx-4" />

            {/* ✨ 암호 변경 */}
            <button 
              className={`w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group ${!isLockEnabled ? 'opacity-50 pointer-events-none' : ''}`}
              onClick={handleChangePassword}
            >
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-[#8E8E93]" />
                <span className="text-[15px] text-white">암호 변경</span>
              </div>
              <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
            </button>

          </div>

          {/* Warning Message */}
          <div className="px-1">
            <p className="text-[13px] text-[#FF453A] leading-relaxed">
              암호를 분실했을 경우 앱을 삭제하고 재설치 해야 하며, 재설치 시 기존 대화내용은 삭제 됩니다.
            </p>
          </div>

        </div>
      </div>

      {/* === Modals === */}

      {/* 1. PIN 입력 모달 */}
      <AnimatePresence>
        {showPinModal && (
          <PinEntryModal 
            step={pinStep}
            mode={pinMode} // ✨ 모드 전달 (텍스트 변경 등 필요 시 사용)
            onComplete={handlePinComplete}
            onClose={() => setShowPinModal(false)}
          />
        )}
      </AnimatePresence>

      {/* 2. 잠금 해제 확인 모달 */}
      <ConfirmModal 
        isOpen={showDisableConfirm}
        onClose={() => setShowDisableConfirm(false)}
        onConfirm={confirmDisable}
        title="화면 잠금 해제"
        content="화면 잠금을 해제하시겠습니까?"
      />

      {/* 3. ✨ 설정/변경 완료 모달 */}
      <AlertModal 
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title={successText.title}
        content={successText.content}
      />

      {/* 4. 생체인증 권한/스캔 모달 */}
      <BiometricAuthModal 
        isOpen={showBiometricModal}
        onClose={() => setShowBiometricModal(false)}
        onSuccess={handleBiometricSuccess}
      />

    </div>
  );
}

// === [Sub Components] ===

// 1. PIN Entry Modal
function PinEntryModal({ 
  step, 
  mode, // ✨ mode prop 추가
  onComplete, 
  onClose 
}: { 
  step: 'create' | 'confirm'; 
  mode: 'setup' | 'change';
  onComplete: (pin: string) => void; 
  onClose: () => void; 
}) {
  const [pin, setPin] = useState('');
  const randomKeys = useMemo(() => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5), []);

  const handlePress = (num: number) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) setTimeout(() => { onComplete(newPin); setPin(''); }, 300);
    }
  };

  const getTitle = () => {
    if (step === 'create') {
      return mode === 'change' ? '새로운 암호 4자리를 입력해주세요' : '암호 4자리를 입력해주세요';
    }
    return '암호를 다시 입력해주세요';
  };

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="fixed inset-0 z-50 bg-[#1C1C1E] flex flex-col">
      <div className="h-14 flex items-center justify-end px-4"><button onClick={onClose} className="p-2 text-white"><X className="w-6 h-6" /></button></div>
      <div className="flex-1 flex flex-col items-center justify-center pb-10">
        <h2 className="text-xl font-bold text-white mb-8">{getTitle()}</h2>
        <div className="flex gap-6 mb-16">{[...Array(4)].map((_, i) => (<div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${i < pin.length ? 'bg-brand-DEFAULT scale-110' : 'bg-[#3A3A3C]'}`} />))}</div>
        <div className="w-full max-w-[320px] grid grid-cols-3 gap-y-6 gap-x-8 px-6">
          {randomKeys.map((num) => (<button key={num} onClick={() => handlePress(num)} className="w-full aspect-square flex items-center justify-center rounded-full text-2xl font-medium text-white hover:bg-white/10 active:scale-95 transition-all">{num}</button>))}
          <div /><button onClick={() => setPin(prev => prev.slice(0, -1))} className="w-full aspect-square flex items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-95 transition-all col-start-3"><Delete className="w-7 h-7" /></button>
        </div>
      </div>
    </motion.div>
  );
}

// 2. Biometric Auth Modal
function BiometricAuthModal({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) {
  const [status, setStatus] = useState<'permission' | 'scanning'>('permission');

  useEffect(() => {
    if (isOpen) setStatus('permission');
  }, [isOpen]);

  const handleAllow = () => {
    setStatus('scanning');
    setTimeout(() => {
      onSuccess();
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
        {status === 'permission' ? (
          <>
            <div className="p-6">
              <div className="w-12 h-12 bg-brand-DEFAULT/20 rounded-full flex items-center justify-center mx-auto mb-4 text-brand-DEFAULT">
                <ScanFace className="w-7 h-7" />
              </div>
              <h3 className="text-white font-bold text-lg mb-2">생체인증 사용</h3>
              <p className="text-[#8E8E93] text-sm leading-relaxed">
                'Grayn' 앱에서 Face ID 또는<br/>Touch ID를 사용하시겠습니까?
              </p>
            </div>
            <div className="flex border-t border-[#3A3A3C] h-12">
              <button onClick={onClose} className="flex-1 text-[#8E8E93] font-medium text-[16px] hover:bg-[#2C2C2E] border-r border-[#3A3A3C]">
                허용 안 함
              </button>
              <button onClick={handleAllow} className="flex-1 text-brand-DEFAULT font-bold text-[16px] hover:bg-[#2C2C2E]">
                확인
              </button>
            </div>
          </>
        ) : (
          <div className="p-8 flex flex-col items-center">
            <motion.div 
              animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }} 
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-16 h-16 rounded-full border-4 border-brand-DEFAULT flex items-center justify-center mb-4"
            >
              <Fingerprint className="w-8 h-8 text-brand-DEFAULT" />
            </motion.div>
            <p className="text-white font-bold text-[16px] animate-pulse">인증 중...</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// 3. Confirm Modal
function ConfirmModal({ isOpen, onClose, onConfirm, title, content }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
        <div className="p-6">
          <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
          {content && <p className="text-[#8E8E93] text-sm">{content}</p>}
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button onClick={onClose} className="flex-1 text-[#8E8E93] font-medium text-[16px] hover:bg-[#2C2C2E] border-r border-[#3A3A3C]">취소</button>
          <button onClick={onConfirm} className="flex-1 text-brand-DEFAULT font-bold text-[16px] hover:bg-[#2C2C2E]">확인</button>
        </div>
      </motion.div>
    </div>
  );
}

// 4. Alert Modal (Updated for dynamic content)
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