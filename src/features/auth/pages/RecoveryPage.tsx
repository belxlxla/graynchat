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

  const [step, setStep] = useState<Step>('select');
  const [type, setType] = useState<RecoveryType>('id');

  const [carrier, setCarrier] = useState('');
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [verifyCode, setVerifyCode] = useState('');
  const [timer, setTimer] = useState(180);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [foundEmail, setFoundEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    let interval: any;
    if (isVerifying && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    if (timer === 0) {
      toast.error('인증 시간이 만료되었습니다.');
      setIsVerifying(false);
      setVerifyCode('');
      setTimer(180);
    }
    return () => clearInterval(interval);
  }, [isVerifying, timer]);

  const handleSelectType = (selectedType: RecoveryType) => {
    setType(selectedType);
    setStep('verify');
    setCarrier('');
    setName('');
    setPhoneNumber('');
    setVerifyCode('');
    setIsVerifying(false);
    setTimer(180);
  };

  // ✅ sms_verifications insert
  const handleSendCode = async () => {
    if (!carrier || !name || phoneNumber.replace(/-/g, '').length < 10) {
      return toast.error('정보를 올바르게 입력해주세요.');
    }

    setIsLoading(true);
    try {
      const raw = phoneNumber.replace(/-/g, '');
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 180 * 1000).toISOString();

      const { error } = await supabase.from('sms_verifications').insert({
        phone_number: raw,
        verification_code: code,
        expires_at: expiresAt,
      });

      if (error) throw error;

      // 실제 SMS 발송 로직 (Naver Cloud SMS 등) 여기에 추가
      setIsVerifying(true);
      setTimer(180);
      toast.success('인증번호가 발송되었습니다.');
    } catch (err) {
      console.error('Send code error:', err);
      toast.error('인증번호 발송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ sms_verifications로 검증 후 users 조회
  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      return toast.error('인증번호 6자리를 입력해주세요.');
    }

    setIsLoading(true);
    try {
      const raw = phoneNumber.replace(/-/g, '');

      // 1. sms_verifications 검증
      const { data: smsData, error: smsError } = await supabase
        .from('sms_verifications')
        .select('id, expires_at')
        .eq('phone_number', raw)
        .eq('verification_code', verifyCode)
        .eq('is_verified', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (smsError || !smsData) {
        return toast.error('인증번호가 일치하지 않습니다.');
      }

      if (new Date(smsData.expires_at) < new Date()) {
        return toast.error('인증번호가 만료되었습니다.');
      }

      // 2. 인증 완료 처리
      await supabase
        .from('sms_verifications')
        .update({
          is_verified: true,
          verified_at: new Date().toISOString(),
        })
        .eq('id', smsData.id);

      // 3. users 테이블에서 이름 + 전화번호로 조회
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('name', name.trim())
        .eq('phone', raw)
        .maybeSingle();

      if (userError) throw userError;

      if (!userData) {
        return toast.error('일치하는 회원 정보를 찾을 수 없습니다.');
      }

      setFoundEmail(userData.email);
      setStep(type === 'id' ? 'id-result' : 'reset-pw');
      toast.success('본인 인증이 완료되었습니다.');
    } catch (err) {
      console.error('Verify Error:', err);
      toast.error('정보 조회 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ RPC 사용 - 프론트 변경 없음
  const handleResetPassword = async () => {
    if (!foundEmail) return toast.error('사용자 이메일을 찾을 수 없습니다.');
    if (newPassword.length < 6) return toast.error('비밀번호는 6자리 이상이어야 합니다.');
    if (newPassword !== confirmPassword) return toast.error('비밀번호가 일치하지 않습니다.');

    const loadingToast = toast.loading('비밀번호를 안전하게 변경 중입니다...');
    try {
      const { error } = await supabase.rpc('reset_password_admin_rpc', {
        target_email: foundEmail,
        new_password: newPassword,
      });

      if (error) throw error;

      toast.success('비밀번호가 변경되었습니다. 다시 로그인해 주세요.', { id: loadingToast });
      setTimeout(() => navigate('/auth/login'), 1500);
    } catch (err: any) {
      console.error('Reset Failure:', err);
      toast.error('비밀번호 변경에 실패했습니다.', { id: loadingToast });
    }
  };

  const maskEmail = (email: string) => {
    if (!email) return '';
    const [local, domain] = email.split('@');
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

          {/* ── 유형 선택 ── */}
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

          {/* ── 본인 인증 ── */}
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
              </div>

              <div className={`space-y-4 ${isVerifying ? 'opacity-50 pointer-events-none' : ''}`}>
                <div className="grid grid-cols-4 gap-2">
                  {CARRIERS.map(c => (
                    <button
                      key={c}
                      onClick={() => setCarrier(c)}
                      className={`h-12 rounded-xl text-xs font-medium border ${
                        carrier === c
                          ? 'bg-brand-DEFAULT border-brand-DEFAULT text-white'
                          : 'bg-[#2C2C2E] border-transparent text-[#8E8E93]'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="이름"
                  className="w-full h-12 bg-[#2C2C2E] rounded-xl px-4 text-white focus:outline-none border border-transparent focus:border-brand-DEFAULT"
                />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="휴대폰 번호"
                  className="w-full h-12 bg-[#2C2C2E] rounded-xl px-4 text-white focus:outline-none border border-transparent focus:border-brand-DEFAULT"
                />
                <button
                  onClick={handleSendCode}
                  disabled={!carrier || !name || !phoneNumber || isLoading}
                  className="w-full h-12 bg-brand-DEFAULT rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center"
                >
                  {isLoading ? '발송 중...' : '인증번호 전송'}
                </button>
              </div>

              {isVerifying && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4 pt-4 border-t border-[#3A3A3C]"
                >
                  <div className="relative">
                    <input
                      type="number"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.slice(0, 6))}
                      placeholder="인증번호 6자리"
                      className="w-full h-12 bg-[#2C2C2E] rounded-xl px-4 text-white focus:outline-none border border-brand-DEFAULT"
                    />
                    <span className="absolute right-4 top-3.5 text-brand-DEFAULT text-sm font-mono">
                      {displayTime}
                    </span>
                  </div>
                  <button
                    onClick={handleVerify}
                    disabled={verifyCode.length !== 6 || isLoading}
                    className="w-full h-12 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isLoading ? '확인 중...' : '인증 확인'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ── 아이디 결과 ── */}
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
              <button
                onClick={() => navigate('/auth/login')}
                className="w-full h-14 bg-brand-DEFAULT text-white font-bold rounded-xl hover:bg-brand-hover transition-colors"
              >
                로그인하러 가기
              </button>
            </motion.div>
          )}

          {/* ── 비밀번호 재설정 ── */}
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
              </div>

              <div className="space-y-4">
                <div className="flex items-center bg-[#2C2C2E] rounded-xl px-4 py-3 border border-[#3A3A3C] focus-within:border-brand-DEFAULT">
                  <Lock className="w-5 h-5 text-[#636366] mr-3" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="6자 이상 입력"
                    className="bg-transparent text-white text-sm w-full focus:outline-none"
                  />
                </div>
                <div className="flex items-center bg-[#2C2C2E] rounded-xl px-4 py-3 border border-[#3A3A3C] focus-within:border-brand-DEFAULT">
                  <Lock className="w-5 h-5 text-[#636366] mr-3" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="비밀번호 재입력"
                    className="bg-transparent text-white text-sm w-full focus:outline-none"
                  />
                </div>
              </div>

              <button
                onClick={handleResetPassword}
                className="w-full h-14 bg-brand-DEFAULT text-white font-bold rounded-xl mt-4 hover:bg-brand-hover transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                비밀번호 변경 <ArrowRight className="w-5 h-5" />
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}