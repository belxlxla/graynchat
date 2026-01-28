import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Mail, Lock, User, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

// Sub Pages
import PhoneAuthPage from './PhoneAuthPage';
import ProfileSetupPage from './ProfileSetupPage';

export default function SignUpPage() {
  const navigate = useNavigate();

  // 단계 관리
  const [step, setStep] = useState<'account' | 'phone' | 'profile'>('account');
  const [isLoading, setIsLoading] = useState(false);

  // 계정 정보 임시 저장
  const [accountData, setAccountData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // 1. 입력 핸들러
  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountData({ ...accountData, [e.target.name]: e.target.value });
  };

  // 2. 계정 생성 (Supabase Auth)
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 유효성 검사
    if (!accountData.name) return toast.error('이름을 입력해주세요.');
    if (!accountData.email || !accountData.password) return toast.error('이메일과 비밀번호를 입력해주세요.');
    if (accountData.password !== accountData.confirmPassword) return toast.error('비밀번호가 일치하지 않습니다.');
    if (accountData.password.length < 6) return toast.error('비밀번호는 6자리 이상이어야 합니다.');

    setIsLoading(true);

    try {
      // A. Supabase Auth 회원가입 시도
      const { data, error } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
        options: {
          data: {
            full_name: accountData.name, 
          }
        }
      });

      // 에러가 있으면 catch 블록으로 이동
      if (error) throw error;

      // 성공 시 처리
      if (data.user) {
        // B. Public Users 테이블에 초기 정보 저장 시도
        const { error: dbError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              email: accountData.email,
              name: accountData.name,
              avatar: null,
              status_message: '반가워요!'
            }
          ]);

        if (dbError) {
          // DB 권한 문제나 기타 에러가 있어도, 계정 생성이 성공했다면 다음 단계로 진행합니다.
          // 프로필 설정 단계에서 다시 시도할 수 있습니다.
          console.warn('DB Insert Warning:', dbError.message);
        }

        toast.success('계정이 생성되었습니다.');
        setStep('phone'); // 다음 단계로 이동
      } else if (!data.session) {
        // 이메일 인증이 켜져있을 경우
        toast('이메일 인증 링크를 보냈습니다. 확인해주세요.', { icon: '📧' });
      }
      
    } catch (error: any) {
      console.error('Signup Error:', error);
      
      // ✨ [에러 처리 강화] 429 Too Many Requests 처리
      if (error.status === 429 || error.message?.includes('rate limit')) {
        toast.error(
          '가입 요청 횟수를 초과했습니다.\n잠시 후(약 15분~1시간) 다시 시도해주세요.', 
          { duration: 5000, icon: '⏳' }
        );
      } else if (error.message?.includes('registered')) {
        toast.error('이미 가입된 이메일입니다.');
      } else {
        toast.error(error.message || '회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // 3. 핸드폰 인증 완료
  const handlePhoneVerified = () => {
    toast.success('본인 인증이 완료되었습니다.');
    setStep('profile');
  };

  // 4. 프로필 설정 완료 (최종)
  const handleProfileCompleted = () => {
    toast.success('회원가입이 모두 완료되었습니다!');
    navigate('/main/friends');
  };

  // === 렌더링 ===

  // Step 2: 핸드폰 인증
  if (step === 'phone') {
    return (
      <PhoneAuthPage 
        onBackToLogin={() => setStep('account')} 
        onNewUser={handlePhoneVerified} 
      />
    );
  }

  // Step 3: 프로필 설정
  if (step === 'profile') {
    return (
      <ProfileSetupPage 
        onComplete={handleProfileCompleted} 
      />
    );
  }

  // Step 1: 계정 입력 (기본)
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
            <h2 className="text-2xl font-bold text-brand-DEFAULT mb-2">계정 만들기</h2>
            <p className="text-[#8E8E93] text-sm">서비스 이용을 위한 계정을 생성합니다.</p>
          </div>

          <form className="space-y-5" onSubmit={handleCreateAccount}>
            
            {/* 이름 */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8E8E93] ml-1">이름</label>
              <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                <User className="w-5 h-5 text-[#636366] mr-3" />
                <input 
                  name="name"
                  type="text"
                  value={accountData.name}
                  onChange={handleAccountChange}
                  placeholder="실명 또는 닉네임"
                  className="bg-transparent text-white text-sm w-full focus:outline-none placeholder-[#636366]"
                />
              </div>
            </div>

            {/* 이메일 */}
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

            {/* 비밀번호 */}
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

            {/* 비밀번호 확인 */}
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