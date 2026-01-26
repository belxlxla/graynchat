// src/features/auth/pages/PhoneAuthPage.tsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

// 아이콘 (경로 확인 필요)
import arrowLeftIcon from '../../../assets/arrow-left.svg';

interface PhoneAuthPageProps {
  onBackToLogin: () => void;
  onNewUser: () => void;
}

const CARRIERS = ['SKT', 'KT', 'LG U+', '알뜰폰'];

export default function PhoneAuthPage({ onBackToLogin, onNewUser }: PhoneAuthPageProps) {
  // === 상태 관리 ===
  const [carrier, setCarrier] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  
  // 단계: input(번호입력) -> verify(인증번호)
  const [step, setStep] = useState<'input' | 'verify'>('input');
  
  // UI 상태: 타이머, 에러, 알럿창 표시 여부
  const [timer, setTimer] = useState(180);
  const [phoneError, setPhoneError] = useState(false);
  const [codeError, setCodeError] = useState(false);
  const [showQuitAlert, setShowQuitAlert] = useState(false);

  // === 타이머 로직 ===
  useEffect(() => {
    let interval: any;
    if (step === 'verify' && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  // === 핸들러 ===

  // 뒤로가기 버튼 클릭 시
  const handleBack = () => {
    if (step === 'verify') {
      // 인증 단계면 -> 입력 단계로 돌아감 (알럿 없음)
      setStep('input');
      setVerifyCode('');
      setCodeError(false);
    } else {
      // 첫 단계면 -> 커스텀 알럿 띄우기 (시스템 알럿 X)
      setShowQuitAlert(true);
    }
  };

  // 번호 입력 (자동 하이픈)
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let formatted = '';
    if (raw.length < 4) formatted = raw;
    else if (raw.length < 8) formatted = `${raw.slice(0, 3)}-${raw.slice(3)}`;
    else formatted = `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 11)}`;
    
    setPhoneNumber(formatted);
    setPhoneError(false);
  };

  // 인증번호 전송
  const handleSendCode = () => {
    const plainPhone = phoneNumber.replace(/-/g, '');
    if (!carrier || plainPhone.length < 10) {
      toast.error('입력한 정보가 올바르지 않습니다.', {
        style: { borderRadius: '10px', background: '#333', color: '#fff' }
      });
      setPhoneError(true);
      return;
    }
    // 성공
    setStep('verify');
    setTimer(180);
    setPhoneError(false);
    toast.success('인증번호가 발송되었습니다.');
  };

  // 재전송
  const handleResend = () => {
    setTimer(180);
    setVerifyCode('');
    setCodeError(false);
    toast.success('인증번호를 재전송했습니다.');
  };

  // 인증 확인
  const handleVerify = () => {
    if (verifyCode === '123456') {
      toast.success('인증이 완료되었습니다.');
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
      
      {/* 1. 상단 네비바 */}
      <div className="h-14 flex items-center -ml-2 mb-6 mt-4">
        <button onClick={handleBack} className="p-2 active:opacity-70">
          <img src={arrowLeftIcon} alt="Back" className="w-6 h-6" />
        </button>
      </div>

      {/* 2. 타이틀 영역 */}
      <motion.div 
        className="mb-10 space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold text-brand-DEFAULT leading-tight whitespace-pre-wrap">
          {step === 'input' ? '휴대폰 번호를\n입력해 주세요' : '인증번호를\n입력해 주세요'}
        </h1>
        <p className="text-[#8E8E93] text-sm">
          {step === 'input' 
             ? '안전한 서비스 이용을 위해 본인 인증이 필요합니다.'
             : '문자로 전송된 인증번호 6자리를 입력해 주세요.'}
        </p>
      </motion.div>

      {/* 3. 메인 폼 영역 */}
      <div className="flex-1 flex flex-col gap-8">
        
        {/* 통신사 & 번호 (인증 단계에선 흐릿하게) */}
        <div className={`space-y-6 transition-opacity duration-300 ${step === 'verify' ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#8E8E93] ml-1">통신사</label>
            <div className="grid grid-cols-4 gap-2">
              {CARRIERS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCarrier(c)}
                  className={`h-12 rounded-xl text-sm font-medium transition-all duration-200 border ${
                    carrier === c
                      ? 'bg-brand-DEFAULT border-brand-DEFAULT text-white'
                      : 'bg-dark-input border-transparent text-[#8E8E93] hover:bg-[#3A3A3C]'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-[#8E8E93] ml-1">휴대폰 번호</label>
            <div className={`relative bg-dark-input rounded-xl overflow-hidden border transition-all duration-200 ${phoneError ? 'border-[#EC5022]' : 'border-transparent focus-within:border-brand-DEFAULT'}`}>
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
                isSendActive 
                  ? 'bg-brand-DEFAULT text-white shadow-lg shadow-brand-DEFAULT/20' 
                  : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'
              }`}
            >
              인증번호 받기
            </motion.button>
          )}
        </div>

        {/* 인증번호 입력창 (슬라이드 애니메이션) */}
        <AnimatePresence>
          {step === 'verify' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="space-y-6 -mt-4"
            >
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#8E8E93] ml-1">인증번호</label>
                <div className={`relative bg-dark-input rounded-xl overflow-hidden border transition-all duration-200 ${codeError ? 'border-[#FF453A]' : 'border-transparent focus-within:border-brand-DEFAULT'}`}>
                  <input 
                    type="number" 
                    value={verifyCode}
                    onChange={(e) => { 
                      setVerifyCode(e.target.value.slice(0, 6)); 
                      setCodeError(false);
                    }}
                    placeholder="123456"
                    className="w-full h-14 bg-transparent px-4 text-lg text-white placeholder-[#636366] outline-none"
                    autoFocus
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-brand-DEFAULT font-medium text-sm tabular-nums">
                    {displayTime}
                  </span>
                </div>
                
                {codeError && (
                  <motion.p 
                    initial={{ opacity: 0, x: -5 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    className="text-[#EC5022] text-xs ml-1 mt-1"
                  >
                    인증번호를 다시 확인해 주세요
                  </motion.p>
                )}
              </div>

              <div>
                <button
                  onClick={handleVerify}
                  disabled={!isVerifyActive}
                  className={`w-full h-14 rounded-xl font-bold text-lg transition-all ${
                    isVerifyActive 
                      ? 'bg-brand-DEFAULT text-white shadow-lg shadow-brand-DEFAULT/20' 
                      : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'
                  }`}
                >
                  인증 완료
                </button>

                <div className="mt-4 flex justify-center">
                   <button onClick={handleResend} className="text-sm text-[#8E8E93] underline underline-offset-4 decoration-[#8E8E93] hover:text-white hover:decoration-white transition-all">
                     인증번호 재전송
                   </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ✨ 4. 커스텀 디자인 알럿 (모달) */}
      <AnimatePresence>
        {showQuitAlert && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            {/* 검은 배경 (Overlay) */}
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowQuitAlert(false)}
            />
            
            {/* 알럿 박스 */}
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#1C1C1E] w-full max-w-[320px] rounded-2xl p-6 text-center shadow-2xl border border-[#2C2C2E]"
            >
              <h3 className="text-white text-lg font-bold mb-2">
                로그인 화면으로<br/>돌아가시겠습니까?
              </h3>
              <p className="text-[#8E8E93] text-sm mb-6 leading-relaxed">
                입력하신 정보가 초기화됩니다.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowQuitAlert(false)}
                  className="flex-1 h-12 rounded-xl bg-[#2C2C2E] text-[#8E8E93] font-medium hover:bg-[#3A3A3C] transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={() => {
                    setShowQuitAlert(false);
                    onBackToLogin(); // 로그인 화면으로 이동
                  }}
                  className="flex-1 h-12 rounded-xl bg-brand-DEFAULT text-white font-bold hover:bg-brand-hover transition-colors"
                >
                  확인
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}