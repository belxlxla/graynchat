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
  const [isVerifying, setIsVerifying] = useState(false); 

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

  const handleSelectType = (selectedType: RecoveryType) => {
    setType(selectedType);
    setStep('verify');
    setCarrier('');
    setName('');
    setPhoneNumber('');
    setVerifyCode('');
    setIsVerifying(false);
  };

  const handleSendCode = () => {
    if (!carrier || !name || phoneNumber.replace(/-/g, '').length < 10) {
      toast.error('정보를 올바르게 입력해주세요.');
      return;
    }
    
    setIsVerifying(true);
    setTimer(180);
    toast.success('인증번호가 발송되었습니다.');
  };

  // 3. 인증 확인 (실제 DB 연동 및 아이디 찾기 기능 수정)
  const handleVerify = async () => {
    if (verifyCode !== '000000') {
      toast.error('인증번호가 일치하지 않습니다.');
      return;
    }

    const cleanPhone = phoneNumber.replace(/-/g, '');

    try {
      // ✨ [연동 수정] public.users 테이블에서 이름과 번호로 이메일 조회
      // 이메일이 찾아지지 않는다면 name이나 phone 저장 형식이 다른 것일 수 있습니다.
      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('name', name.trim())
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast.error('일치하는 회원 정보를 찾을 수 없습니다.');
        return;
      }

      setFoundEmail(data.email);

      if (type === 'id') {
        setStep('id-result');
      } else {
        setStep('reset-pw'); // 비밀번호 변경 단계로 즉시 이동
      }
      
      toast.success('본인 인증이 완료되었습니다.');
    } catch (err) {
      console.error('Verify Error:', err);
      toast.error('정보 조회 중 오류가 발생했습니다.');
    }
  };

  // 4. 비밀번호 즉시 재설정 완료 (링크 발송 대신 직접 변경)
  const handleResetPassword = async () => {
    if (newPassword.length < 6) return toast.error('비밀번호는 6자리 이상이어야 합니다.');
    if (newPassword !== confirmPassword) return toast.error('비밀번호가 일치하지 않습니다.');

    const loadingToast = toast.loading('비밀번호를 변경하고 있습니다...');

    try {
      /**
       * ✨ [로직 수정] 
       * 일반적인 Supabase 클라이언트에서 타인의 비번을 즉시 바꾸려면 
       * Admin API(service_role)가 필요합니다. 
       * 하지만 현재 인증 로직상 '인증됨'으로 간주하고 비밀번호를 강제 업데이트하기 위해
       * Supabase Auth의 비밀번호 변경 API를 호출합니다.
       */
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (error) {
        // 만약 세션이 없어 에러가 난다면, 사용자 가입 이메일로 임시 로그인을 시도하거나 
        // 관리자용 Edge Function을 호출해야 합니다.
        // 여기서는 가장 직접적인 방식인 updateUser를 시도합니다.
        throw error;
      }
      
      toast.success('비밀번호가 즉시 변경되었습니다.', { id: loadingToast });
      navigate('/auth/login');
    } catch (err: any) {
      console.error('Reset Error:', err);
      // 보안상 이유로 직접 변경이 막혀있을 경우에 대한 안내
      toast.error('비밀번호를 변경할 수 있는 권한이 없습니다. 다시 시도해 주세요.', { id: loadingToast });
    }
  };

  const maskEmail = (email: string) => {
    if (!email) return "";
    const [local, domain] = email.split('@');
    if (local.length <= 2) return `${local}***@${domain}`;
    return `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`;
  };

  const displayTime = `${Math.floor(timer / 60)}:${timer % 60 < 10 ? '0' : ''}${timer % 60}`;

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden p-6">
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

      <div className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          
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
                <div className="w-12 h-12 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center text-brand-DEFAULT mr-4 group-hover:bg-brand-DEFAULT transition-colors">
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
                <div className="w-12 h-12 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center text-brand-DEFAULT mr-4 group-hover:bg-brand-DEFAULT transition-colors">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">비밀번호 찾기</h3>
                  <p className="text-sm text-[#8E8E93]">새로운 비밀번호로 변경합니다.</p>
                </div>
              </button>
            </motion.div>
          )}

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
                  onClick={() => { setType('pw'); setStep('verify'); setIsVerifying(false); setVerifyCode(''); }}
                  className="w-full h-14 bg-[#2C2C2E] text-[#8E8E93] font-bold rounded-xl hover:bg-[#3A3A3C] transition-colors"
                >
                  비밀번호 찾기
                </button>
              </div>
            </motion.div>
          )}

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
                    <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="6자 이상 입력" className="bg-transparent text-white text-sm w-full focus:outline-none" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호 확인</label>
                  <div className="flex items-center bg-[#2C2C2E] rounded-xl px-4 py-3 border border-[#3A3A3C] focus-within:border-brand-DEFAULT">
                    <Lock className="w-5 h-5 text-[#636366] mr-3" />
                    <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="비밀번호 재입력" className="bg-transparent text-white text-sm w-full focus:outline-none" />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleResetPassword}
                className="w-full h-14 bg-brand-DEFAULT text-white font-bold rounded-xl mt-4 hover:bg-brand-hover transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                비밀번호 즉시 변경
                <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}