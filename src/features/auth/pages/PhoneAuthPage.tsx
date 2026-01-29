import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

interface PhoneAuthPageProps {
  onBackToLogin?: () => void;
  onNewUser?: () => void;
}

const CARRIERS = ['SKT', 'KT', 'LG U+', '알뜰폰'];

export default function PhoneAuthPage({ onBackToLogin, onNewUser }: PhoneAuthPageProps) {
  const { user } = useAuth();
  const [carrier, setCarrier] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  
  const [step, setStep] = useState<'input' | 'verify'>('input');
  const [timer, setTimer] = useState(180);
  const [phoneError, setPhoneError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [showQuitAlert, setShowQuitAlert] = useState(false);

  useEffect(() => {
    let interval: any;
    if (step === 'verify' && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handleBack = () => {
    if (step === 'verify') {
      setStep('input');
      setVerifyCode('');
      setCodeError(false);
    } else {
      setShowQuitAlert(true);
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let formatted = '';
    if (raw.length < 4) formatted = raw;
    else if (raw.length < 8) formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    else formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    setPhoneNumber(formatted);
    setPhoneError(false);
  };

  const handleSendCode = () => {
    if (!carrier || phoneNumber.replace(/-/g, '').length < 10) {
      toast.error('입력한 정보가 올바르지 않습니다.');
      setPhoneError(true);
      return;
    }
    setStep('verify');
    toast.success('인증번호가 발송되었습니다.');
  };

  const handleVerify = async () => {
    if (verifyCode === '000000' && user) {
      try {
        await supabase
          .from('users')
          .update({ phone: phoneNumber.replace(/-/g, '') })
          .eq('id', user.id);
        
        toast.success('본인 인증이 완료되었습니다.');
        if (onNewUser) onNewUser(); // ✨ 부모의 navigate 수행
      } catch (e) {
        toast.error('저장 중 오류가 발생했습니다.');
      }
    } else {
      setCodeError(true);
    }
  };

  const displayTime = `${Math.floor(timer / 60)}:${timer % 60 < 10 ? '0' : ''}${timer % 60}`;

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-white px-6 relative">
      <div className="h-14 flex items-center -ml-2 mb-6 mt-4">
        <button onClick={handleBack} className="p-2 active:opacity-70 text-white">
          <ChevronLeft className="w-7 h-7" />
        </button>
      </div>
      <motion.div className="mb-10 space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-brand-DEFAULT leading-tight whitespace-pre-wrap">{step === 'input' ? '휴대폰 번호를\n입력해 주세요' : '인증번호를\n입력해 주세요'}</h1>
      </motion.div>
      <div className="flex-1 flex flex-col gap-8">
        <div className={`space-y-6 ${step === 'verify' ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="grid grid-cols-4 gap-2">
            {CARRIERS.map(c => (
              <button key={c} onClick={() => setCarrier(c)} className={`h-12 rounded-xl text-xs border ${carrier === c ? 'bg-brand-DEFAULT border-brand-DEFAULT text-white' : 'bg-[#2C2C2E] border-transparent'}`}>{c}</button>
            ))}
          </div>
          <div className={`bg-[#2C2C2E] rounded-xl border ${phoneError ? 'border-[#EC5022]' : 'border-transparent'}`}>
            <input type="tel" value={phoneNumber} onChange={handlePhoneChange} placeholder="010-0000-0000" maxLength={13} className="w-full h-14 bg-transparent px-4 text-lg outline-none" />
          </div>
          {step === 'input' && <button onClick={handleSendCode} className="w-full h-14 bg-brand-DEFAULT rounded-xl font-bold text-lg">인증번호 받기</button>}
        </div>
        <AnimatePresence>
          {step === 'verify' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 -mt-4">
              <div className={`relative bg-[#2C2C2E] rounded-xl border ${codeError ? 'border-[#EC5022]' : 'border-transparent'}`}>
                <input type="number" value={verifyCode} onChange={e => { setVerifyCode(e.target.value.slice(0, 6)); setCodeError(false); }} placeholder="000000" className="w-full h-14 bg-transparent px-4 text-lg outline-none" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-DEFAULT text-sm font-mono">{displayTime}</span>
              </div>
              <button onClick={handleVerify} className="w-full h-14 bg-brand-DEFAULT rounded-xl font-bold text-lg">인증 완료</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {showQuitAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowQuitAlert(false)} />
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="relative bg-[#1C1C1E] w-full max-w-[320px] rounded-2xl p-6 text-center border border-[#2C2C2E]">
              <h3 className="text-white text-lg font-bold mb-6">가입을 중단하시겠습니까?</h3>
              <div className="flex gap-3">
                <button onClick={() => setShowQuitAlert(false)} className="flex-1 h-12 rounded-xl bg-[#2C2C2E] text-[#8E8E93]">계속하기</button>
                <button onClick={() => onBackToLogin && onBackToLogin()} className="flex-1 h-12 rounded-xl bg-brand-DEFAULT text-white font-bold">중단</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}