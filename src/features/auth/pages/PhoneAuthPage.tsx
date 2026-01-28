import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft } from 'lucide-react'; // 아이콘 변경
import toast from 'react-hot-toast';

interface PhoneAuthPageProps {
  onBackToLogin: () => void;
  onNewUser: () => void;
}

const CARRIERS = ['SKT', 'KT', 'LG U+', '알뜰폰'];

export default function PhoneAuthPage({ onBackToLogin, onNewUser }: PhoneAuthPageProps) {
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
    const plainPhone = phoneNumber.replace(/-/g, '');
    if (!carrier || plainPhone.length < 10) {
      toast.error('입력한 정보가 올바르지 않습니다.');
      setPhoneError(true);
      return;
    }
    setStep('verify');
    setTimer(180);
    setPhoneError(false);
    toast.success('인증번호가 발송되었습니다.');
  };

  const handleResend = () => {
    setTimer(180);
    setVerifyCode('');
    setCodeError(false);
    toast.success('인증번호를 재전송했습니다.');
  };

  const handleVerify = () => {
    if (verifyCode === '000000') { // 테스트용 코드
      // 실제로는 여기서 서버 인증 로직 수행
      onNewUser(); 
    } else {
      setCodeError(true);
    }
  };

  const isSendActive = carrier !== '' && phoneNumber.length >= 10;
  const isVerifyActive = verifyCode.length === 6;
  const displayTime = `${Math.floor(timer / 60)}:${timer % 60 < 10 ? '0' : ''}${timer % 60}`;

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-white px-6 relative">
      <div className="h-14 flex items-center -ml-2 mb-6 mt-4">
        <button onClick={handleBack} className="p-2 active:opacity-70 text-white">
          <ChevronLeft className="w-7 h-7" />
        </button>
      </div>

      <motion.div className="mb-10 space-y-2" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-brand-DEFAULT leading-tight whitespace-pre-wrap">
          {step === 'input' ? '휴대폰 번호를\n입력해 주세요' : '인증번호를\n입력해 주세요'}
        </h1>
        <p className="text-[#8E8E93] text-sm">
          {step === 'input' ? '안전한 서비스 이용을 위해 본인 인증이 필요합니다.' : '문자로 전송된 인증번호 6자리를 입력해 주세요.'}
        </p>
      </motion.div>

      <div className="flex-1 flex flex-col gap-8">
        <div className={`space-y-6 transition-opacity duration-300 ${step === 'verify' ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#8E8E93] ml-1">통신사</label>
            <div className="grid grid-cols-4 gap-2">
              {CARRIERS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCarrier(c)}
                  className={`h-12 rounded-xl text-sm font-medium transition-all duration-200 border ${
                    carrier === c ? 'bg-brand-DEFAULT border-brand-DEFAULT text-white' : 'bg-[#2C2C2E] border-transparent text-[#8E8E93] hover:bg-[#3A3A3C]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-[#8E8E93] ml-1">휴대폰 번호</label>
            <div className={`relative bg-[#2C2C2E] rounded-xl overflow-hidden border transition-all duration-200 ${phoneError ? 'border-[#EC5022]' : 'border-transparent focus-within:border-brand-DEFAULT'}`}>
              <input 
                type="tel" 
                value={phoneNumber}
                onChange={handlePhoneChange}
                placeholder="010-0000-0000"
                maxLength={13}
                className="w-full h-14 bg-transparent px-4 text-lg text-white placeholder-[#636366] outline-none"
              />
            </div>
          </div>

          {step === 'input' && (
            <motion.button
              layout
              onClick={handleSendCode}
              disabled={!isSendActive}
              className={`w-full h-14 rounded-xl font-bold text-lg mt-4 transition-all ${
                isSendActive ? 'bg-brand-DEFAULT text-white shadow-lg' : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'
              }`}
            >
              인증번호 받기
            </motion.button>
          )}
        </div>

        <AnimatePresence>
          {step === 'verify' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="space-y-6 -mt-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#8E8E93] ml-1">인증번호</label>
                <div className={`relative bg-[#2C2C2E] rounded-xl overflow-hidden border transition-all duration-200 ${codeError ? 'border-[#FF453A]' : 'border-transparent focus-within:border-brand-DEFAULT'}`}>
                  <input 
                    type="number" 
                    value={verifyCode}
                    onChange={(e) => { setVerifyCode(e.target.value.slice(0, 6)); setCodeError(false); }}
                    placeholder="000000"
                    className="w-full h-14 bg-transparent px-4 text-lg text-white placeholder-[#636366] outline-none"
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-DEFAULT font-medium text-sm tabular-nums">{displayTime}</span>
                </div>
                {codeError && <p className="text-[#EC5022] text-xs ml-1 mt-1">인증번호를 다시 확인해 주세요</p>}
              </div>

              <div>
                <button
                  onClick={handleVerify}
                  disabled={!isVerifyActive}
                  className={`w-full h-14 rounded-xl font-bold text-lg transition-all ${
                    isVerifyActive ? 'bg-brand-DEFAULT text-white shadow-lg' : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'
                  }`}
                >
                  인증 완료
                </button>
                <div className="mt-4 flex justify-center">
                   <button onClick={handleResend} className="text-sm text-[#8E8E93] underline underline-offset-4 decoration-[#8E8E93] hover:text-white transition-all">인증번호 재전송</button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 뒤로가기 확인 모달 */}
      <AnimatePresence>
        {showQuitAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowQuitAlert(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#1C1C1E] w-full max-w-[320px] rounded-2xl p-6 text-center shadow-2xl border border-[#2C2C2E]">
              <h3 className="text-white text-lg font-bold mb-2">가입을 중단하시겠습니까?</h3>
              <p className="text-[#8E8E93] text-sm mb-6 leading-relaxed">입력하신 정보가 초기화됩니다.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowQuitAlert(false)} className="flex-1 h-12 rounded-xl bg-[#2C2C2E] text-[#8E8E93] font-medium hover:bg-[#3A3A3C] transition-colors">계속하기</button>
                <button onClick={onBackToLogin} className="flex-1 h-12 rounded-xl bg-brand-DEFAULT text-white font-bold hover:bg-brand-hover transition-colors">중단</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}