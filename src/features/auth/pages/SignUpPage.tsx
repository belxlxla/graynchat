import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Mail, Lock, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

// Sub Pages
import PhoneAuthPage from './PhoneAuthPage';
import ProfileSetupPage from './ProfileSetupPage';

export default function SignUpPage() {
  const navigate = useNavigate();

  // 단계 관리: 'account'(계정정보) -> 'phone'(휴대폰인증) -> 'profile'(프로필설정)
  const [step, setStep] = useState<'account' | 'phone' | 'profile'>('account');
  const [isLoading, setIsLoading] = useState(false);

  // 계정 정보 임시 저장
  const [accountData, setAccountData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [userId, setUserId] = useState<string | null>(null);

  // 1. 계정 정보 입력 핸들러
  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountData({ ...accountData, [e.target.name]: e.target.value });
  };

  // 2. 계정 생성 (Supabase Auth) -> 성공 시 핸드폰 인증으로 이동
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountData.email || !accountData.password) return toast.error('모든 정보를 입력해주세요.');
    if (accountData.password !== accountData.confirmPassword) return toast.error('비밀번호가 일치하지 않습니다.');
    if (accountData.password.length < 6) return toast.error('비밀번호는 6자리 이상이어야 합니다.');

    setIsLoading(true);

    try {
      // Supabase 회원가입 시도
      const { data, error } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
      });

      if (error) throw error;

      if (data.user) {
        setUserId(data.user.id);
        toast.success('계정이 생성되었습니다. 본인 인증을 진행해주세요.');
        setStep('phone'); // 다음 단계로 이동
      }
    } catch (error: any) {
      console.error('Signup Error:', error);
      toast.error(error.message || '회원가입에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 3. 핸드폰 인증 완료 핸들러
  const handlePhoneVerified = () => {
    toast.success('본인 인증이 완료되었습니다.');
    setStep('profile'); // 프로필 설정 단계로 이동
  };

  // 4. 프로필 설정 완료 (최종 가입 완료)
  const handleProfileCompleted = () => {
    toast.success('회원가입이 완료되었습니다!');
    navigate('/main/friends'); // 메인으로 이동
  };

  // === 렌더링 ===

  // 2단계: 핸드폰 인증 페이지
  if (step === 'phone') {
    return (
      <PhoneAuthPage 
        onBackToLogin={() => setStep('account')} // 뒤로가기 시 계정 입력으로
        onNewUser={handlePhoneVerified} 
      />
    );
  }

  // 3단계: 프로필 설정 페이지
  if (step === 'profile') {
    return (
      <ProfileSetupPage 
        onComplete={handleProfileCompleted} 
      />
    );
  }

  // 1단계: 계정 정보 입력 (기본 화면)
  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden p-6">
      <header className="h-14 flex items-center shrink-0 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-xl font-bold ml-1">회원가입</h1>
      </header>

      <div className="flex-1 flex flex-col justify-center">
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-brand-DEFAULT mb-2">계정 정보 입력</h2>
            <p className="text-[#8E8E93] text-sm">로그인에 사용할 이메일과 비밀번호를 입력해주세요.</p>
          </div>

          <form className="space-y-5" onSubmit={handleCreateAccount}>
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8E8E93] ml-1">이메일</label>
              <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                <Mail className="w-5 h-5 text-[#636366] mr-3" />
                <input 
                  name="email"
                  type="email"
                  value={accountData.email}
                  onChange={handleAccountChange}
                  placeholder="example@grayn.com"
                  className="bg-transparent text-white text-sm w-full focus:outline-none placeholder-[#636366]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호</label>
              <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                <Lock className="w-5 h-5 text-[#636366] mr-3" />
                <input 
                  name="password"
                  type="password"
                  value={accountData.password}
                  onChange={handleAccountChange}
                  placeholder="6자리 이상 입력"
                  className="bg-transparent text-white text-sm w-full focus:outline-none placeholder-[#636366]"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호 확인</label>
              <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                <Lock className="w-5 h-5 text-[#636366] mr-3" />
                <input 
                  name="confirmPassword"
                  type="password"
                  value={accountData.confirmPassword}
                  onChange={handleAccountChange}
                  placeholder="비밀번호를 다시 입력하세요"
                  className="bg-transparent text-white text-sm w-full focus:outline-none placeholder-[#636366]"
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-4 bg-brand-DEFAULT text-white font-bold rounded-2xl mt-8 hover:bg-brand-hover transition-colors shadow-lg shadow-brand-DEFAULT/20 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '다음 (본인인증)'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}