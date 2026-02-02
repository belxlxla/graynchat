import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, Lock, Fingerprint, KeyRound, Delete, X, 
  ScanFace, AlertTriangle, ShieldCheck 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { 
  startRegistration,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable
} from '@simplewebauthn/browser';

export default function ScreenLockPage() {
  const navigate = useNavigate();

  // === States ===
  const [isLockEnabled, setIsLockEnabled] = useState(() => localStorage.getItem('grayn_lock_enabled') === 'true');
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(() => localStorage.getItem('grayn_biometric_enabled') === 'true');
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);

  const [showPinModal, setShowPinModal] = useState(false); 
  const [showDisableConfirm, setShowDisableConfirm] = useState(false); 
  const [showSuccessModal, setShowSuccessModal] = useState(false); 
  const [showBiometricModal, setShowBiometricModal] = useState(false);

  const [pinMode, setPinMode] = useState<'setup' | 'change'>('setup');
  const [pinStep, setPinStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  
  const [successText, setSuccessText] = useState({ title: '', content: '' });

  // 생체 인증 지원 여부 확인
  const checkBiometricSupport = useCallback(async () => {
    try {
      const webAuthnSupported = browserSupportsWebAuthn();
      const platformSupported = await platformAuthenticatorIsAvailable();
      
      const isSupported = webAuthnSupported && platformSupported;
      setIsBiometricAvailable(isSupported);
      
      if (!isSupported) {
        console.log('생체 인증을 지원하지 않는 환경입니다.');
      }
    } catch (error) {
      console.error('Biometric check error:', error);
      setIsBiometricAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkBiometricSupport();
  }, [checkBiometricSupport]);

  // 등록된 생체 인증 확인
  const checkBiometricRegistration = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data, error } = await supabase
        .from('biometric_credentials')
        .select('id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Check biometric error:', error);
      }

      const hasCredential = !!data;
      setIsBiometricEnabled(hasCredential);
      localStorage.setItem('grayn_biometric_enabled', String(hasCredential));
    } catch (error) {
      console.error('Check biometric registration error:', error);
    }
  }, []);

  useEffect(() => {
    checkBiometricRegistration();
  }, [checkBiometricRegistration]);

  // DB 및 로컬 저장 로직
  const saveSettings = async (lock: boolean, pin?: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await supabase.from('users').update({ 
        is_lock_enabled: lock
      }).eq('id', session.user.id);
    }
    localStorage.setItem('grayn_lock_enabled', String(lock));
    if (pin) localStorage.setItem('grayn_lock_pin', pin);
    if (!lock) {
      localStorage.removeItem('grayn_lock_pin');
      localStorage.removeItem('grayn_fail_count');
    }
  };

  const handleToggleLock = () => {
    if (isLockEnabled) {
      setShowDisableConfirm(true);
    } else {
      setPinMode('setup');
      setPinStep('create');
      setFirstPin('');
      setShowPinModal(true);
    }
  };

  const handleChangePassword = () => {
    if (!isLockEnabled) return toast.error('화면 잠금을 먼저 설정해주세요.');
    setPinMode('change');
    setPinStep('create');
    setFirstPin('');
    setShowPinModal(true);
  };

  const handlePinComplete = async (pin: string) => {
    if (pinStep === 'create') {
      setFirstPin(pin);
      setPinStep('confirm');
    } else {
      if (pin === firstPin) {
        setShowPinModal(false);
        if (pinMode === 'setup') {
          setIsLockEnabled(true);
          await saveSettings(true, pin);
          setSuccessText({ title: '설정 완료', content: '보안 잠금이 성공적으로 활성화되었습니다.' });
        } else {
          await saveSettings(true, pin);
          setSuccessText({ title: '변경 완료', content: '비밀번호가 안전하게 변경되었습니다.' });
        }
        setShowSuccessModal(true);
      } else {
        toast.error('암호가 일치하지 않습니다. 다시 시도해주세요.');
        setPinStep('create');
        setFirstPin('');
      }
    }
  };

  const confirmDisable = async () => {
    setIsLockEnabled(false);
    
    // 생체 인증도 함께 비활성화
    if (isBiometricEnabled) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase
            .from('biometric_credentials')
            .delete()
            .eq('user_id', session.user.id);
        }
        setIsBiometricEnabled(false);
        localStorage.setItem('grayn_biometric_enabled', 'false');
      } catch (error) {
        console.error('Delete biometric error:', error);
      }
    }
    
    await saveSettings(false);
    setShowDisableConfirm(false);
    toast.success('보안 잠금이 해제되었습니다.');
  };

  const handleToggleBiometric = () => {
    if (!isLockEnabled) {
      toast.error('화면 잠금을 먼저 설정해주세요.');
      return;
    }
    
    if (!isBiometricAvailable) {
      toast.error('이 기기는 생체 인증을 지원하지 않습니다.');
      return;
    }

    if (isBiometricEnabled) {
      // 비활성화 확인
      setShowBiometricModal(true);
    } else {
      // 활성화
      setShowBiometricModal(true);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">보안 및 잠금</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pt-4">
        <div className="px-5 space-y-6">
          <div className="bg-[#2C2C2E] rounded-[24px] overflow-hidden border border-[#3A3A3C] shadow-xl">
            {/* 화면 잠금 토글 */}
            <div className="flex items-center justify-between px-6 py-5">
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl ${isLockEnabled ? 'bg-brand-DEFAULT/10 text-brand-DEFAULT' : 'bg-[#3A3A3C] text-[#8E8E93]'}`}>
                  <Lock size={20} />
                </div>
                <div>
                  <span className="text-[15px] font-bold text-white block">화면 잠금</span>
                  <span className="text-[12px] text-[#8E8E93]">{isLockEnabled ? '활성화됨' : '보호되지 않음'}</span>
                </div>
              </div>
              <div 
                onClick={handleToggleLock}
                className={`w-[56px] h-[32px] flex items-center rounded-full p-1 cursor-pointer transition-colors duration-500 ${
                  isLockEnabled ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
                }`}
              >
                <motion.div
                  className="w-6 h-6 bg-white rounded-full shadow-lg"
                  animate={{ x: isLockEnabled ? 24 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                />
              </div>
            </div>

            <div className="h-[1px] bg-[#3A3A3C] opacity-50 mx-4" />

            {/* 생체인증 토글 */}
            <div className={`flex items-center justify-between px-6 py-5 transition-opacity duration-300 ${!isLockEnabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
              <div className="flex items-center gap-4">
                <div className={`p-2 rounded-xl ${isBiometricEnabled ? 'bg-brand-DEFAULT/10 text-brand-DEFAULT' : 'bg-[#3A3A3C] text-[#8E8E93]'}`}>
                  <ScanFace size={20} />
                </div>
                <div>
                  <span className="text-[15px] font-bold text-white block">생체인증 사용</span>
                  <span className="text-[12px] text-[#8E8E93]">
                    {isBiometricAvailable ? 'Face ID / Touch ID / 지문' : '지원되지 않음'}
                  </span>
                </div>
              </div>
              <div 
                onClick={handleToggleBiometric}
                className={`w-[56px] h-[32px] flex items-center rounded-full p-1 cursor-pointer transition-colors duration-500 ${
                  isBiometricEnabled ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
                }`}
              >
                <motion.div
                  className="w-6 h-6 bg-white rounded-full shadow-lg"
                  animate={{ x: isBiometricEnabled ? 24 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                />
              </div>
            </div>

            <div className="h-[1px] bg-[#3A3A3C] opacity-50 mx-4" />

            {/* 암호 변경 */}
            <button 
              className={`w-full flex items-center justify-between px-6 py-5 hover:bg-[#3A3A3C]/50 active:bg-[#48484A] transition-all group ${!isLockEnabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}
              onClick={handleChangePassword}
            >
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-xl bg-[#3A3A3C] text-[#8E8E93]">
                  <KeyRound size={20} />
                </div>
                <span className="text-[15px] font-bold text-white">비밀번호 변경</span>
              </div>
              <ChevronRight className="w-5 h-5 text-[#636366] group-hover:text-white transition-colors" />
            </button>
          </div>

          {/* 주의 문구 */}
          <div className="px-2 py-4 bg-[#EC5022]/5 rounded-2xl border border-[#EC5022]/10">
            <div className="flex gap-3">
              <AlertTriangle size={18} className="text-[#EC5022] shrink-0" />
              <p className="text-[12px] text-[#EC5022]/90 leading-relaxed">
                <span className="font-bold">주의:</span> 암호를 분실한 경우 계정 보호를 위해 앱을 재설치해야 하며, 이 과정에서 모든 대화 내용이 초기화됩니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showPinModal && (
          <PinEntryModal step={pinStep} mode={pinMode} onComplete={handlePinComplete} onClose={() => setShowPinModal(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showDisableConfirm && (
          <ConfirmModal 
            onClose={() => setShowDisableConfirm(false)} 
            onConfirm={confirmDisable} 
            title="잠금을 해제하시겠습니까?" 
            content="잠금을 해제하면 타인이 내 대화 리스트를\n볼 수 있어 보안에 취약해집니다." 
            confirmText="해제" 
            type="danger" 
          />
        )}
      </AnimatePresence>

      <AlertModal isOpen={showSuccessModal} onClose={() => setShowSuccessModal(false)} title={successText.title} content={successText.content} />

      <BiometricAuthModal 
        isOpen={showBiometricModal} 
        onClose={() => setShowBiometricModal(false)} 
        isEnabled={isBiometricEnabled}
        onSuccess={() => {
          checkBiometricRegistration();
          setShowBiometricModal(false);
        }}
      />
    </div>
  );
}

// === Sub Components ===

function PinEntryModal({ step, mode, onComplete, onClose }: any) {
  const [pin, setPin] = useState('');
  const [noiseKeys, setNoiseKeys] = useState<number[]>([]);
  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  const handlePress = (num: number) => {
    if (pin.length < 4) {
      const randomNoises = [num];
      while(randomNoises.length < 3) {
        const r = Math.floor(Math.random() * 10);
        if(!randomNoises.includes(r)) randomNoises.push(r);
      }
      setNoiseKeys(randomNoises);
      const newPin = pin + num;
      setPin(newPin);
      setTimeout(() => setNoiseKeys([]), 120);
      if (newPin.length === 4) {
        setTimeout(() => { onComplete(newPin); setPin(''); }, 300);
      }
    }
  };

  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 30, stiffness: 300 }} className="fixed inset-0 z-50 bg-[#1C1C1E] flex flex-col">
      <div className="h-14 flex items-center justify-between px-6">
        <div className="w-10" />
        <span className="text-[14px] font-bold text-[#8E8E93] tracking-widest uppercase">Security Lock</span>
        <button onClick={onClose} className="p-2 text-[#8E8E93] hover:text-white"><X size={24} /></button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center pb-12">
        <h2 className="text-xl font-bold text-white mb-10 text-center px-10 whitespace-pre-wrap">
          {step === 'create' ? (mode === 'change' ? '변경할 새로운 암호를\n입력해주세요' : '앱 잠금에 사용할\n암호를 입력해주세요') : '확인을 위해 한번 더\n입력해주세요'}
        </h2>
        <div className="flex gap-6 mb-24">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all duration-300 ${i < pin.length ? 'bg-brand-DEFAULT scale-125 shadow-[0_0_10px_rgba(var(--brand-rgb),0.5)]' : 'bg-[#3A3A3C]'}`} />
          ))}
        </div>
        <div className="w-full max-w-[320px] px-6">
          <div className="grid grid-cols-3 gap-y-6">
            {keys.map((num) => (
              <div key={num} className={`${num === 0 ? 'col-start-2' : ''} flex justify-center`}>
                <button onClick={() => handlePress(num)} className="relative w-16 h-16 flex items-center justify-center rounded-full">
                  <motion.div animate={{ scale: noiseKeys.includes(num) ? 1 : 0.8, opacity: noiseKeys.includes(num) ? 1 : 0 }} className="absolute inset-0 bg-white/10 rounded-full" />
                  <span className="text-2xl font-bold text-white relative z-10">{num}</span>
                </button>
              </div>
            ))}
            <div className="col-start-3 row-start-4 flex justify-center items-center">
              <button onClick={() => setPin(prev => prev.slice(0, -1))} className="text-[#8E8E93] active:text-white transition-colors"><Delete size={28} /></button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ConfirmModal({ onClose, onConfirm, title, content, confirmText = "확인", type = "normal" }: any) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E]">
        <div className="p-6 text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${type === 'danger' ? 'bg-[#EC5022]/10' : 'bg-brand-DEFAULT/10'}`}><AlertTriangle className={`w-6 h-6 ${type === 'danger' ? 'text-[#EC5022]' : 'text-brand-DEFAULT'}`} /></div>
          <h3 className="text-white font-bold text-lg mb-2">{title}</h3>
          <p className="text-xs text-[#8E8E93] leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button onClick={onClose} className="flex-1 text-[#8E8E93] font-medium text-[15px] hover:bg-[#2C2C2E] border-r border-[#3A3A3C]">취소</button>
          <button onClick={onConfirm} className={`flex-1 font-bold text-[15px] hover:bg-[#2C2C2E] ${type === 'danger' ? 'text-[#EC5022]' : 'text-brand-DEFAULT'}`}>{confirmText}</button>
        </div>
      </motion.div>
    </div>
  );
}

function AlertModal({ isOpen, onClose, title, content }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E]">
        <div className="p-8 text-center">
          <div className="w-14 h-14 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center mx-auto mb-5"><ShieldCheck size={30} className="text-brand-DEFAULT" /></div>
          <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
          <p className="text-[#8E8E93] text-[13px] leading-relaxed">{content}</p>
        </div>
        <button onClick={onClose} className="w-full h-12 border-t border-[#3A3A3C] text-brand-DEFAULT font-bold text-[15px] hover:bg-[#2C2C2E]">확인</button>
      </motion.div>
    </div>
  );
}

function BiometricAuthModal({ isOpen, onClose, isEnabled, onSuccess }: any) {
  const [status, setStatus] = useState<'permission' | 'scanning'>('permission');
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => { 
    if (isOpen) setStatus('permission'); 
  }, [isOpen]);

  const getDeviceType = () => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad/.test(ua)) return 'iOS';
    if (/Android/.test(ua)) return 'Android';
    return 'Unknown';
  };

  // Base64URL 인코딩 함수
  const bufferToBase64url = (buffer: Uint8Array): string => {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  };

  const handleRegisterBiometric = async () => {
    setStatus('scanning');
    setIsProcessing(true);
    
    const loadingToast = toast.loading('생체 인증 등록 중...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.dismiss(loadingToast);
        toast.error('로그인이 필요합니다.');
        onClose();
        return;
      }

      // Challenge 생성
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);

      const publicKeyCredentialCreationOptions = {
        challenge: bufferToBase64url(challenge),
        rp: {
          name: "Grayn",
          id: window.location.hostname,
        },
        user: {
          id: bufferToBase64url(new TextEncoder().encode(session.user.id)),
          name: session.user.email || session.user.id,
          displayName: session.user.email?.split('@')[0] || '사용자',
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" as const },
          { alg: -257, type: "public-key" as const },
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform" as const,
          userVerification: "required" as const,
          requireResidentKey: false,
        },
        timeout: 60000,
        attestation: "none" as const,
      };

      const credential = await startRegistration(publicKeyCredentialCreationOptions);

      // DB에 저장
      const { error: insertError } = await supabase
        .from('biometric_credentials')
        .insert({
          user_id: session.user.id,
          credential_id: credential.id,
          public_key: credential.response.publicKey,
          device_type: getDeviceType(),
          counter: 0,
        });

      if (insertError) throw insertError;

      localStorage.setItem('grayn_biometric_enabled', 'true');

      toast.dismiss(loadingToast);
      toast.success('생체 인증이 등록되었습니다!');
      
      onSuccess();
    } catch (error: any) {
      console.error('Biometric registration error:', error);
      toast.dismiss(loadingToast);
      
      if (error.name === 'NotAllowedError') {
        toast.error('생체 인증이 취소되었습니다.');
      } else if (error.name === 'NotSupportedError') {
        toast.error('이 기기는 생체 인증을 지원하지 않습니다.');
      } else {
        toast.error('생체 인증 등록에 실패했습니다.');
      }
      
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemoveBiometric = async () => {
    setIsProcessing(true);
    const loadingToast = toast.loading('생체 인증 삭제 중...');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.dismiss(loadingToast);
        toast.error('로그인이 필요합니다.');
        onClose();
        return;
      }

      const { error } = await supabase
        .from('biometric_credentials')
        .delete()
        .eq('user_id', session.user.id);

      if (error) throw error;

      localStorage.setItem('grayn_biometric_enabled', 'false');

      toast.dismiss(loadingToast);
      toast.success('생체 인증이 삭제되었습니다.');
      
      onSuccess();
    } catch (error) {
      console.error('Remove biometric error:', error);
      toast.dismiss(loadingToast);
      toast.error('생체 인증 삭제에 실패했습니다.');
    } finally {
      setIsProcessing(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E]">
        {status === 'permission' ? (
          <>
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center mx-auto mb-6 text-brand-DEFAULT">
                <ScanFace size={36} />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">
                {isEnabled ? '생체 인증 삭제' : '생체 인증 등록'}
              </h3>
              <p className="text-[#8E8E93] text-sm leading-relaxed">
                {isEnabled ? (
                  <>등록된 생체 인증을 삭제하시겠습니까?<br/>삭제 후 비밀번호로만 잠금 해제가 가능합니다.</>
                ) : (
                  <>기기의 Face ID, Touch ID 또는<br/>지문 인식을 등록하여 안전하게<br/>그레인을 보호합니다.</>
                )}
              </p>
            </div>
            <div className="flex border-t border-[#3A3A3C] h-12">
              <button 
                onClick={onClose} 
                disabled={isProcessing}
                className="flex-1 text-[#8E8E93] font-medium text-[15px] border-r border-[#3A3A3C] hover:bg-[#2C2C2E] transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button 
                onClick={isEnabled ? handleRemoveBiometric : handleRegisterBiometric}
                disabled={isProcessing}
                className={`flex-1 font-bold text-[15px] hover:bg-[#2C2C2E] transition-colors disabled:opacity-50 ${
                  isEnabled ? 'text-[#EC5022]' : 'text-brand-DEFAULT'
                }`}
              >
                {isEnabled ? '삭제' : '등록하기'}
              </button>
            </div>
          </>
        ) : (
          <div className="p-12 flex flex-col items-center">
            <motion.div 
              animate={{ scale: [1, 1.1, 1] }} 
              transition={{ repeat: Infinity, duration: 2 }} 
              className="w-20 h-20 rounded-full bg-brand-DEFAULT/10 flex items-center justify-center mb-6"
            >
              <Fingerprint size={40} className="text-brand-DEFAULT" />
            </motion.div>
            <p className="text-white font-bold text-center mb-2">생체 인증 대기 중...</p>
            <p className="text-[#8E8E93] text-xs text-center">
              기기의 Face ID, Touch ID 또는<br/>지문 인식을 진행해주세요
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}