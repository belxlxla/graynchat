import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

const CARRIERS = ['SKT', 'KT', 'LG U+', '알뜰폰'] as const;
const VERIFY_TIME = 180;
const DEMO_CODE = '000000';

type StepType = 'input' | 'verify' | 'name';

export default function PhoneAuthPage() {
  const navigate = useNavigate();
  
  const [carrier, setCarrier] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [userName, setUserName] = useState('');
  
  const [step, setStep] = useState<StepType>('input');
  const [timer, setTimer] = useState(VERIFY_TIME);
  const [phoneError, setPhoneError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [showQuitAlert, setShowQuitAlert] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [isVerifyMode, setIsVerifyMode] = useState(false);
  const [verifyType, setVerifyType] = useState<'phone' | 'name' | ''>('');

  useEffect(() => {
    const signupUserId = sessionStorage.getItem('signup_user_id');
    const verifyUserId = sessionStorage.getItem('verify_user_id');
    const verifyReturnType = sessionStorage.getItem('verify_return_type');
    
    if (signupUserId) {
      setIsSignupMode(true);
    } else if (verifyUserId && verifyReturnType) {
      setIsVerifyMode(true);
      setVerifyType(verifyReturnType as 'phone' | 'name');
    } else {
      toast.error('잘못된 접근입니다.');
      navigate('/settings/account', { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    if (step !== 'verify' || timer <= 0) return;
    const interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    return () => clearInterval(interval);
  }, [step, timer]);

  useEffect(() => {
    if (timer === 0) {
      toast.error('인증 시간이 만료되었습니다.');
      setStep('input');
      setVerifyCode('');
      setTimer(VERIFY_TIME);
    }
  }, [timer]);

  const handleBack = useCallback(() => {
    if (step === 'verify') {
      setStep('input');
      setVerifyCode('');
      setTimer(VERIFY_TIME);
    } else if (step === 'name') {
      setStep('verify');
    } else {
      if (isSignupMode) {
        setShowQuitAlert(true);
      } else {
        navigate('/settings/account');
      }
    }
  }, [step, isSignupMode, navigate]);

  const formatPhoneNumber = (value: string) => {
    const raw = value.replace(/[^0-9]/g, '');
    if (raw.length < 4) return raw;
    if (raw.length < 8) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
    return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(formatPhoneNumber(e.target.value));
    setPhoneError(false);
  };

  const handleSendCode = () => {
    const raw = phoneNumber.replace(/-/g, '');
    if (!carrier) return toast.error('통신사를 선택해주세요.');
    if (raw.length < 10) return toast.error('휴대폰 번호를 확인해주세요.');
    setStep('verify');
    setTimer(VERIFY_TIME);
    toast.success('인증번호가 발송되었습니다.');
  };

  const handleVerify = async () => {
    if (verifyCode !== DEMO_CODE) {
      setCodeError(true);
      return toast.error('인증번호가 일치하지 않습니다.');
    }

    if (isVerifyMode && verifyType === 'phone') {
      await handlePhoneUpdate();
    } else if (isVerifyMode && verifyType === 'name') {
      setStep('name');
    } else if (isSignupMode) {
      await handleSignupComplete();
    }
  };

  const handlePhoneUpdate = async () => {
    const verifyUserId = sessionStorage.getItem('verify_user_id');
    if (!verifyUserId) return;

    setIsVerifying(true);
    try {
      const cleanPhone = phoneNumber.replace(/-/g, '');
      const { error } = await supabase
        .from('users')
        .update({ phone: cleanPhone, updated_at: new Date().toISOString() })
        .eq('id', verifyUserId);

      if (error) throw error;

      toast.success('전화번호가 변경되었습니다.');
      sessionStorage.removeItem('verify_user_id');
      sessionStorage.removeItem('verify_return_type');
      sessionStorage.removeItem('verify_current_phone');
      navigate('/settings/account', { replace: true });
      
    } catch (error) {
      console.error(error);
      toast.error('변경 중 오류가 발생했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleNameUpdate = async () => {
    const verifyUserId = sessionStorage.getItem('verify_user_id');
    if (!verifyUserId || !userName.trim()) {
      toast.error('이름을 입력해주세요.');
      return;
    }

    setIsVerifying(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: userName.trim(), updated_at: new Date().toISOString() })
        .eq('id', verifyUserId);

      if (error) throw error;

      toast.success('이름이 변경되었습니다.');
      sessionStorage.removeItem('verify_user_id');
      sessionStorage.removeItem('verify_return_type');
      sessionStorage.removeItem('verify_current_name');
      navigate('/settings/account', { replace: true });
      
    } catch (error) {
      console.error(error);
      toast.error('변경 중 오류가 발생했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignupComplete = async () => {
    const signupUserId = sessionStorage.getItem('signup_user_id');
    const signupEmail = sessionStorage.getItem('signup_email');
    const signupPassword = sessionStorage.getItem('signup_password');

    if (!signupUserId) return navigate('/auth/signup');

    setIsVerifying(true);
    try {
      const cleanPhone = phoneNumber.replace(/-/g, '');
      const { error: updateError } = await supabase
        .from('users')
        .update({ phone: cleanPhone, updated_at: new Date().toISOString() })
        .eq('id', signupUserId);

      if (updateError) throw updateError;

      if (signupEmail && signupPassword) {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: signupEmail,
          password: signupPassword
        });
        if (loginError) throw loginError;
      }

      toast.success('인증되었습니다.');
      navigate('/auth/profile-setup', { replace: true });
      
    } catch (error) {
      console.error(error);
      toast.error('처리 중 오류가 발생했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleQuit = () => {
    sessionStorage.clear();
    navigate('/auth/login', { replace: true });
  };

  const displayTime = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, '0')}`;

  const getTitle = () => {
    if (step === 'name') return '이름을\n입력해 주세요';
    if (step === 'verify') return '인증번호를\n입력해 주세요';
    return '휴대폰 번호를\n입력해 주세요';
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-white px-6">
      <div className="h-14 flex items-center -ml-2 mb-6 mt-4">
        <button onClick={handleBack} className="p-2"><ChevronLeft className="w-7 h-7" /></button>
      </div>
      <motion.div className="mb-10 space-y-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-2xl font-bold text-brand-DEFAULT leading-tight whitespace-pre-line">
          {getTitle()}
        </h1>
      </motion.div>
      <div className="flex-1 flex flex-col gap-6">
        {step === 'name' ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <div className="bg-[#2C2C2E] rounded-xl border border-transparent">
              <input 
                type="text" 
                value={userName} 
                onChange={(e) => setUserName(e.target.value)} 
                placeholder="홍길동" 
                className="w-full h-14 bg-transparent px-4 text-lg outline-none" 
                autoFocus 
              />
            </div>
            <button 
              onClick={handleNameUpdate} 
              disabled={!userName.trim() || isVerifying} 
              className="w-full h-14 bg-brand-DEFAULT rounded-xl font-bold text-lg disabled:opacity-50 transition-all"
            >
              {isVerifying ? '변경 중...' : '변경 완료'}
            </button>
          </motion.div>
        ) : (
          <>
            <div className={`space-y-6 ${step === 'verify' ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-4 gap-2">
                {CARRIERS.map(c => (
                  <button key={c} onClick={() => setCarrier(c)} className={`h-12 rounded-xl text-xs font-medium border transition-all ${carrier === c ? 'bg-brand-DEFAULT border-brand-DEFAULT text-white' : 'bg-[#2C2C2E] border-transparent text-[#8E8E93]'}`}>{c}</button>
                ))}
              </div>
              <div className={`bg-[#2C2C2E] rounded-xl border ${phoneError ? 'border-[#EC5022]' : 'border-transparent'}`}>
                <input type="tel" value={phoneNumber} onChange={handlePhoneChange} placeholder="010-0000-0000" maxLength={13} className="w-full h-14 bg-transparent px-4 text-lg outline-none" disabled={step === 'verify'} />
              </div>
              {step === 'input' && (
                <button onClick={handleSendCode} disabled={!carrier || phoneNumber.length < 12} className="w-full h-14 bg-brand-DEFAULT rounded-xl font-bold text-lg disabled:opacity-50 transition-all">인증번호 받기</button>
              )}
            </div>
            <AnimatePresence>
              {step === 'verify' && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                  <div className={`relative bg-[#2C2C2E] rounded-xl border ${codeError ? 'border-[#EC5022]' : 'border-transparent'}`}>
                    <input type="number" value={verifyCode} onChange={e => setVerifyCode(e.target.value.slice(0, 6))} placeholder="000000" className="w-full h-14 bg-transparent px-4 text-lg outline-none pr-20" autoFocus />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-DEFAULT text-sm font-mono font-bold">{displayTime}</span>
                  </div>
                  <button onClick={handleVerify} disabled={verifyCode.length !== 6 || isVerifying} className="w-full h-14 bg-brand-DEFAULT rounded-xl font-bold text-lg flex items-center justify-center gap-2">
                    {isVerifying ? '인증 중...' : '인증 완료'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
      {showQuitAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-black/70">
          <div className="bg-[#1C1C1E] w-full max-w-[320px] rounded-2xl p-6 text-center border border-[#2C2C2E]">
            <h3 className="text-white text-lg font-bold mb-2">가입을 중단하시겠습니까?</h3>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowQuitAlert(false)} className="flex-1 h-12 rounded-xl bg-[#2C2C2E] text-white">계속하기</button>
              <button onClick={handleQuit} className="flex-1 h-12 rounded-xl bg-[#EC5022] font-bold text-white">중단</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}