import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

const CARRIERS = ['SKT', 'KT', 'LG U+', '알뜰폰'] as const;
const VERIFY_TIME = 180;
const DEMO_CODE = '000000';

type StepType = 'input' | 'verify';

export default function PhoneAuthPage() {
  const navigate = useNavigate();
  
  const [carrier, setCarrier] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  
  const [step, setStep] = useState<StepType>('input');
  const [timer, setTimer] = useState(VERIFY_TIME);
  const [phoneError, setPhoneError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [showQuitAlert, setShowQuitAlert] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // 회원가입 정보 확인
  useEffect(() => {
    const signupUserId = sessionStorage.getItem('signup_user_id');
    if (!signupUserId) {
      toast.error('회원가입 정보를 찾을 수 없습니다.');
      navigate('/auth/signup', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (step !== 'verify' || timer <= 0) return;
    
    const interval = setInterval(() => {
      setTimer(prev => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [step, timer]);

  useEffect(() => {
    if (timer === 0) {
      toast.error('인증 시간이 만료되었습니다. 다시 시도해주세요.');
      setStep('input');
      setVerifyCode('');
      setTimer(VERIFY_TIME);
    }
  }, [timer]);

  const handleBack = useCallback(() => {
    if (step === 'verify') {
      setStep('input');
      setVerifyCode('');
      setCodeError(false);
      setTimer(VERIFY_TIME);
    } else {
      setShowQuitAlert(true);
    }
  }, [step]);

  const formatPhoneNumber = useCallback((value: string): string => {
    const raw = value.replace(/[^0-9]/g, '');
    if (raw.length < 4) return raw;
    if (raw.length < 8) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
  }, []);

  const handlePhoneChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
    setPhoneError(false);
  }, [formatPhoneNumber]);

  const validatePhoneNumber = useCallback((): boolean => {
    const raw = phoneNumber.replace(/-/g, '');
    return raw.length === 10 || raw.length === 11;
  }, [phoneNumber]);

  const handleSendCode = useCallback(() => {
    if (!carrier) {
      toast.error('통신사를 선택해주세요.');
      return;
    }

    if (!validatePhoneNumber()) {
      toast.error('올바른 휴대폰 번호를 입력해주세요.');
      setPhoneError(true);
      return;
    }

    setStep('verify');
    setTimer(VERIFY_TIME);
    toast.success('인증번호가 발송되었습니다.');
  }, [carrier, validatePhoneNumber]);

  const handleVerify = useCallback(async () => {
    const signupUserId = sessionStorage.getItem('signup_user_id');
    const signupEmail = sessionStorage.getItem('signup_email');
    const signupPassword = sessionStorage.getItem('signup_password');

    if (!signupUserId) {
      toast.error('회원가입 정보를 찾을 수 없습니다.');
      navigate('/auth/signup', { replace: true });
      return;
    }

    if (verifyCode.length !== 6) {
      toast.error('6자리 인증번호를 입력해주세요.');
      return;
    }

    if (verifyCode !== DEMO_CODE) {
      setCodeError(true);
      toast.error('인증번호가 일치하지 않습니다.');
      return;
    }

    setIsVerifying(true);
    
    try {
      const cleanPhone = phoneNumber.replace(/-/g, '');
      
      // 휴대폰 번호 저장
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          phone: cleanPhone,
          updated_at: new Date().toISOString()
        })
        .eq('id', signupUserId);

      if (updateError) throw updateError;

      // 로그인 처리
      if (signupEmail && signupPassword) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: signupEmail,
          password: signupPassword
        });

        if (loginError) throw loginError;
      }

      toast.success('본인 인증이 완료되었습니다.');
      
      // 프로필 설정 페이지로 이동
      setTimeout(() => {
        navigate('/auth/profile-setup', { replace: true });
      }, 500);
      
    } catch (error) {
      console.error('Phone verification error:', error);
      toast.error('인증 처리 중 오류가 발생했습니다.');
    } finally {
      setIsVerifying(false);
    }
  }, [verifyCode, phoneNumber, navigate]);

  const handleQuit = useCallback(() => {
    // 세션 스토리지 정리
    sessionStorage.removeItem('signup_email');
    sessionStorage.removeItem('signup_password');
    sessionStorage.removeItem('signup_user_id');
    
    navigate('/auth/login', { replace: true });
  }, [navigate]);

  const displayTime = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-white px-6 relative">
      <div className="h-14 flex items-center -ml-2 mb-6 mt-4">
        <button 
          onClick={handleBack} 
          className="p-2 active:opacity-70 text-white transition-opacity"
          aria-label="뒤로가기"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
      </div>

      <motion.div 
        className="mb-10 space-y-2" 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-brand-DEFAULT leading-tight whitespace-pre-wrap">
          {step === 'input' ? '휴대폰 번호를\n입력해 주세요' : '인증번호를\n입력해 주세요'}
        </h1>
        {step === 'verify' && (
          <p className="text-sm text-[#8E8E93]">
            {phoneNumber}로 전송된 인증번호를 입력해주세요.
          </p>
        )}
      </motion.div>

      <div className="flex-1 flex flex-col gap-8">
        <div className={`space-y-6 transition-opacity duration-300 ${
          step === 'verify' ? 'opacity-40 pointer-events-none' : ''
        }`}>
          <div className="grid grid-cols-4 gap-2">
            {CARRIERS.map(c => (
              <button 
                key={c} 
                onClick={() => setCarrier(c)} 
                className={`h-12 rounded-xl text-xs font-medium border transition-all ${
                  carrier === c 
                    ? 'bg-brand-DEFAULT border-brand-DEFAULT text-white scale-95' 
                    : 'bg-[#2C2C2E] border-transparent text-[#8E8E93] hover:bg-[#3A3A3C]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className={`bg-[#2C2C2E] rounded-xl border transition-colors ${
            phoneError ? 'border-[#EC5022]' : 'border-transparent'
          }`}>
            <input 
              type="tel" 
              value={phoneNumber} 
              onChange={handlePhoneChange} 
              placeholder="010-0000-0000" 
              maxLength={13} 
              className="w-full h-14 bg-transparent px-4 text-lg outline-none"
              disabled={step === 'verify'}
            />
          </div>

          {step === 'input' && (
            <button 
              onClick={handleSendCode} 
              disabled={!carrier || !phoneNumber}
              className="w-full h-14 bg-brand-DEFAULT rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              인증번호 받기
            </button>
          )}
        </div>

        <AnimatePresence>
          {step === 'verify' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6 -mt-4"
            >
              <div className={`relative bg-[#2C2C2E] rounded-xl border transition-colors ${
                codeError ? 'border-[#EC5022]' : 'border-transparent'
              }`}>
                <input 
                  type="number" 
                  inputMode="numeric"
                  value={verifyCode} 
                  onChange={e => { 
                    const value = e.target.value.slice(0, 6);
                    setVerifyCode(value); 
                    setCodeError(false); 
                  }} 
                  placeholder="000000" 
                  maxLength={6}
                  className="w-full h-14 bg-transparent px-4 text-lg outline-none pr-20" 
                  autoFocus
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-DEFAULT text-sm font-mono font-bold">
                  {displayTime}
                </span>
              </div>

              <button 
                onClick={handleVerify} 
                disabled={verifyCode.length !== 6 || isVerifying}
                className="w-full h-14 bg-brand-DEFAULT rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                {isVerifying ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    인증 중...
                  </>
                ) : (
                  '인증 완료'
                )}
              </button>

              <button
                onClick={() => {
                  setStep('input');
                  setVerifyCode('');
                  setCodeError(false);
                  setTimer(VERIFY_TIME);
                }}
                className="w-full text-sm text-[#8E8E93] hover:text-white transition-colors"
              >
                인증번호를 받지 못하셨나요? <span className="text-brand-DEFAULT font-medium">재전송</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showQuitAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
              onClick={() => setShowQuitAlert(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#1C1C1E] w-full max-w-[320px] rounded-2xl p-6 text-center border border-[#2C2C2E]"
            >
              <h3 className="text-white text-lg font-bold mb-2">가입을 중단하시겠습니까?</h3>
              <p className="text-sm text-[#8E8E93] mb-6">
                지금까지 입력한 정보가 삭제됩니다.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowQuitAlert(false)} 
                  className="flex-1 h-12 rounded-xl bg-[#2C2C2E] text-white font-medium hover:bg-[#3A3A3C] transition-colors"
                >
                  계속하기
                </button>
                <button 
                  onClick={handleQuit} 
                  className="flex-1 h-12 rounded-xl bg-[#EC5022] text-white font-bold hover:bg-red-600 transition-colors"
                >
                  중단
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}