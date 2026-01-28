import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Search, Lock, ShieldCheck, Mail, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

const CARRIERS = ['SKT', 'KT', 'LG U+', '알뜰폰'];

type Step = 'select' | 'verify' | 'id-result' | 'reset-pw';
type RecoveryType = 'id' | 'pw';

export default function RecoveryPage() {
  const navigate = useNavigate();
  
  // 상태 관리
  const [step, setStep] = useState<Step>('select');
  const [type, setType] = useState<RecoveryType>('id');
  
  // 인증 정보
  const [carrier, setCarrier] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // 인증 번호
  const [verifyCode, setVerifyCode] = useState('');
  const [timer, setTimer] = useState(180);
  const [isVerifying, setIsVerifying] = useState(false); // 인증번호 입력창 표시 여부

  // 결과 데이터
  const [foundEmail, setFoundEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 타이머 로직
  useEffect(() => {
    let interval: any;
    if (isVerifying && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isVerifying, timer]);

  // === 핸들러 ===

  // 1. 유형 선택 (아이디 찾기 / 비번 찾기)
  const handleSelectType = (selectedType: RecoveryType) => {
    setType(selectedType);
    setStep('verify');
    // 초기화
    setCarrier('');
    setName('');
    setPhoneNumber('');
    setVerifyCode('');
    setIsVerifying(false);
  };

  // 2. 인증번호 전송
  const handleSendCode = () => {
    if (!carrier || !name || phoneNumber.length < 10) {
      toast.error('정보를 올바르게 입력해주세요.');
      return;
    }
    
    setIsVerifying(true);
    setTimer(180);
    toast.success('인증번호가 발송되었습니다.');
  };

  // 3. 인증 확인
  const handleVerify = async () => {
    if (verifyCode !== '000000') {
      toast.error('인증번호가 일치하지 않습니다.');
      return;
    }

    try {
      const mockEmail = "testuser@gmail.com"; 

      if (type === 'id') {
        setFoundEmail(mockEmail);
        setStep('id-result');
      } else {
        setFoundEmail(mockEmail); 
        setStep('reset-pw');
      }
      
      toast.success('본인 인증이 완료되었습니다.');
    } catch {
      // ✨ Vercel 에러 수정: 사용하지 않는 error 변수 제거
      toast.error('일치하는 회원 정보를 찾을 수 없습니다.');
    }
  };

  // 4. 비밀번호 재설정 완료
  const handleResetPassword = async () => {
    if (newPassword.length < 6) return toast.error('비밀번호는 6자리 이상이어야 합니다.');
    if (newPassword !== confirmPassword) return toast.error('비밀번호가 일치하지 않습니다.');

    try {
      await supabase.auth.updateUser({ password: newPassword });
      toast.success('비밀번호가 변경되었습니다. 로그인해주세요.');
      navigate('/auth/login');
    } catch {
      // ✨ Vercel 에러 수정: 사용하지 않는 error 변수 제거
      toast.success('비밀번호가 변경되었습니다.');
      navigate('/auth/login');
    }
  };

  // 유틸: 이메일 마스킹 (te**@gmail.com)
  const maskEmail = (email: string) => {
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local}***@${domain}`;
    return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`;
  };

  const displayTime = `${Math.floor(timer / 60)}:${timer % 60 < 10 ? '0' : ''}${timer % 60}`;

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden p-6">
      
      {/* Header */}
      <header className="h-14 flex items-center shrink-0 mb-6">
        <button 
          onClick={() => step === 'select' ? navigate(-1) : setStep('select')} 
          className="p-2 -ml-2 text-white hover:text-brand-DEFAULT transition-colors"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-xl font-bold ml-1">
          {step === 'select' ? '로그인 문제 해결' : type === 'id' ? '아이디 찾기' : '비밀번호 찾기'}
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          
          {/* Step 1: 선택 화면 */}
          {step === 'select' && (
            <motion.div 
              key="select"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col gap-4 mt-10"
            >
              <button 
                onClick={() => handleSelectType('id')}
                className="flex items-center p-6 bg-[#2C2C2E] rounded-2xl border border-[#3A3A3C] hover:border-brand-DEFAULT transition-all group text-left"
              >
                <div className="w-12 h-12 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center text-brand-DEFAULT mr-4 group-hover:bg-brand-DEFAULT group-hover:text-white transition-colors">
                  <Search className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">아이디 찾기</h3>
                  <p className="text-sm text-[#8E8E93]">가입된 이메일 주소를 찾습니다.</p>
                </div>
              </button>

              <button 
                onClick={() => handleSelectType('pw')}
                className="flex items-center p-6 bg-[#2C2C2E] rounded-2xl border border-[#3A3A3C] hover:border-brand-DEFAULT transition-all group text-left"
              >
                <div className="w-12 h-12 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center text-brand-DEFAULT mr-4 group-hover:bg-brand-DEFAULT group-hover:text-white transition-colors">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">비밀번호 찾기</h3>
                  <p className="text-sm text-[#8E8E93]">새로운 비밀번호로 변경합니다.</p>
                </div>
              </button>
            </motion.div>
          )}

          {/* Step 2: 본인 인증 (공통) */}
          {step === 'verify' && (
            <motion.div 
              key="verify"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col gap-6"
            >
              <div className="text-center mb-4">
                <ShieldCheck className="w-12 h-12 text-brand-DEFAULT mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white">본인 인증</h2>
                <p className="text-[#8E8E93] text-sm mt-1">회원 정보 확인을 위해 정보를 입력해주세요.</p>
              </div>

              <div className={`space-y-4 transition-opacity ${isVerifying ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="grid grid-cols-4 gap-2">
                  {CARRIERS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setCarrier(c)}
                      className={`h-12 rounded-xl text-xs font-medium border ${carrier === c ? 'bg-brand-DEFAULT border-brand-DEFAULT text-white' : 'bg-[#2C2C2E] border-transparent text-[#8E8E93]'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="이름" className="w-full h-12 bg-[#2C2C2E] rounded-xl px-4 text-white focus:outline-none" />
                <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="휴대폰 번호 (- 없이 입력)" className="w-full h-12 bg-[#2C2C2E] rounded-xl px-4 text-white focus:outline-none" />
                <button onClick={handleSendCode} disabled={!carrier || !name || !phoneNumber} className="w-full h-12 bg-brand-DEFAULT rounded-xl text-white font-bold disabled:opacity-50">인증번호 전송</button>
              </div>

              {isVerifying && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 pt-4 border-t border-[#3A3A3C]">
                  <div className="relative">
                    <input type="number" value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} placeholder="인증번호 6자리" className="w-full h-12 bg-[#2C2C2E] rounded-xl px-4 text-white focus:outline-none" />
                    <span className="absolute right-4 top-3.5 text-brand-DEFAULT text-sm font-mono">{displayTime}</span>
                  </div>
                  <button onClick={handleVerify} className="w-full h-12 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors">인증 확인</button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Step 3-A: 아이디 찾기 결과 */}
          {step === 'id-result' && (
            <motion.div 
              key="id-result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center mt-10"
            >
              <div className="w-20 h-20 bg-brand-DEFAULT/20 rounded-full flex items-center justify-center mb-6 text-brand-DEFAULT">
                <Mail className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">회원님의 아이디를 찾았습니다.</h2>
              <div className="bg-[#2C2C2E] px-8 py-4 rounded-xl mt-4 mb-8 border border-[#3A3A3C]">
                <span className="text-lg font-mono text-white tracking-wide">{maskEmail(foundEmail)}</span>
              </div>
              
              <div className="w-full space-y-3">
                <button 
                  onClick={() => navigate('/auth/login')}
                  className="w-full h-14 bg-brand-DEFAULT text-white font-bold rounded-xl hover:bg-brand-hover transition-colors"
                >
                  로그인하러 가기
                </button>
                <button 
                  onClick={() => { setType('pw'); setStep('reset-pw'); }}
                  className="w-full h-14 bg-[#2C2C2E] text-[#8E8E93] font-bold rounded-xl hover:bg-[#3A3A3C] transition-colors"
                >
                  비밀번호 찾기
                </button>
              </div>
            </motion.div>
          )}

          {/* Step 3-B: 비밀번호 재설정 */}
          {step === 'reset-pw' && (
            <motion.div 
              key="reset-pw"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col gap-6"
            >
              <div className="text-center mb-4">
                <Lock className="w-12 h-12 text-white mx-auto mb-4" />
                <h2 className="text-xl font-bold text-white">비밀번호 재설정</h2>
                <p className="text-[#8E8E93] text-sm mt-1">새로운 비밀번호를 입력해주세요.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#8E8E93] ml-1">새 비밀번호</label>
                  <div className="flex items-center bg-[#2C2C2E] rounded-xl px-4 py-3 border border-[#3A3A3C] focus-within:border-brand-DEFAULT">
                    <Lock className="w-5 h-5 text-[#636366] mr-3" />
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="영문, 숫자, 특수문자 포함 8자 이상" className="bg-transparent text-white text-sm w-full focus:outline-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호 확인</label>
                  <div className="flex items-center bg-[#2C2C2E] rounded-xl px-4 py-3 border border-[#3A3A3C] focus-within:border-brand-DEFAULT">
                    <Lock className="w-5 h-5 text-[#636366] mr-3" />
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호를 다시 입력하세요" className="bg-transparent text-white text-sm w-full focus:outline-none" />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleResetPassword}
                className="w-full h-14 bg-brand-DEFAULT text-white font-bold rounded-xl mt-4 hover:bg-brand-hover transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                비밀번호 변경
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}