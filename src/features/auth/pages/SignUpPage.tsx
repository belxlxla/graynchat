import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, Mail, Lock, User, Loader2, 
  Check, ChevronRight, Eye, EyeOff, X, Phone
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function SignUpPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  // [수정] phone 필드 초기값 보장
  const [accountData, setAccountData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  const [agreedTerms, setAgreedTerms] = useState({
    service: false,
    location: false,
    privacy: false,
    sensitive: false,
    operation: false,
    youth: false,
    marketing: false,
  });

  const policyLinks: Record<string, string> = {
    service: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    location: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    privacy: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    sensitive: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    operation: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    youth: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
    marketing: 'https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link',
  };

  const validatePassword = (password: string): string => {
    if (password.length === 0) return '';
    if (password.length < 8) return '비밀번호는 8자리 이상이어야 합니다.';
    if (!/[A-Z]/.test(password)) return '대문자를 최소 1개 포함해야 합니다.';
    if (!/[a-z]/.test(password)) return '소문자를 최소 1개 포함해야 합니다.';
    if (!/[0-9]/.test(password)) return '숫자를 최소 1개 포함해야 합니다.';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return '특수문자를 최소 1개 포함해야 합니다.';
    return '';
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAccountData({ ...accountData, [name]: value });

    if (name === 'password') {
      const error = validatePassword(value);
      setPasswordError(error);
      if (accountData.confirmPassword && value !== accountData.confirmPassword) {
        setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
      } else {
        setConfirmPasswordError('');
      }
    }

    if (name === 'confirmPassword') {
      if (value !== accountData.password) {
        setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
      } else {
        setConfirmPasswordError('');
      }
    }
  };

  const handleAllAgree = () => {
    const isAllChecked = Object.values(agreedTerms).every(val => val);
    setAgreedTerms({
      service: !isAllChecked,
      location: !isAllChecked,
      privacy: !isAllChecked,
      sensitive: !isAllChecked,
      operation: !isAllChecked,
      youth: !isAllChecked,
      marketing: !isAllChecked,
    });
  };

  const handleTermToggle = (key: keyof typeof agreedTerms) => {
    setAgreedTerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenPolicy = (key: string) => {
    const url = policyLinks[key];
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isRequiredAgreed = useMemo(() => {
    return agreedTerms.service && agreedTerms.location && agreedTerms.privacy && 
           agreedTerms.sensitive && agreedTerms.operation && agreedTerms.youth;
  }, [agreedTerms]);

  const isPasswordValid = useMemo(() => {
    return !passwordError && accountData.password.length > 0;
  }, [passwordError, accountData.password]);

  const isConfirmPasswordValid = useMemo(() => {
    return !confirmPasswordError && accountData.confirmPassword.length > 0 && 
           accountData.password === accountData.confirmPassword;
  }, [confirmPasswordError, accountData.confirmPassword, accountData.password]);

  // 애플 로그인
  const handleAppleLogin = async () => {
    setIsAppleLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error: any) {
      console.error('Apple Login Error:', error);
      toast.error('Apple 로그인에 실패했습니다.');
      setIsAppleLoading(false);
    }
  };

  // 일반 회원가입
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountData.name.trim()) return toast.error('이름을 입력해주세요.');
    if (!accountData.email.trim()) return toast.error('이메일을 입력해주세요.');
    if (!accountData.phone.trim()) return toast.error('전화번호를 입력해주세요.'); // 전화번호 체크
    if (!isRequiredAgreed) return toast.error('필수 약관에 동의해 주세요.');

    setIsLoading(true);
    
    try {
      // 1. Auth 회원가입 요청 (Metadata에 전화번호 저장)
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: accountData.email.trim(),
        password: accountData.password,
        options: { 
          data: { 
            full_name: accountData.name.trim(),
            phone: accountData.phone.trim(), // 메타데이터 저장
            marketing_agreed: agreedTerms.marketing 
          }
        }
      });

      if (signUpError) throw signUpError;
      
      // 2. public.users 테이블 업데이트 (Upsert 사용)
      if (authData.user) {
        const { error: updateError } = await supabase
          .from('users')
          .upsert({
            id: authData.user.id,
            email: accountData.email.trim(),
            name: accountData.name.trim(),
            phone: accountData.phone.trim(), // DB 저장
            is_terms_agreed: true,
            is_marketing_agreed: agreedTerms.marketing,
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' }); // 충돌 시 업데이트

        if (updateError) {
          console.error('User Update Error (Non-fatal):', updateError);
        }

        // 3. 임시 세션 데이터 저장
        sessionStorage.setItem('signup_email', accountData.email.trim());
        sessionStorage.setItem('signup_password', accountData.password);
        sessionStorage.setItem('signup_user_id', authData.user.id);

        toast.success('계정이 생성되었습니다.');
        navigate('/auth/phone', { replace: true });
      }

    } catch (error: any) {
      console.error('Signup Error:', error);
      let message = error.message || '회원가입 중 오류가 발생했습니다.';
      if (message.includes('Database error')) message = '서버 설정 오류입니다. (DB Trigger 확인 필요)';
      if (message.includes('User already registered')) message = '이미 가입된 이메일입니다.';
      
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const termList = [
    { key: 'service', label: '이용약관', required: true },
    { key: 'location', label: '위치기반서비스 이용약관', required: true },
    { key: 'privacy', label: '개인정보처리방침', required: true },
    { key: 'sensitive', label: '민감정보 수집 및 이용 동의', required: true },
    { key: 'operation', label: '운영정책', required: true },
    { key: 'youth', label: '청소년보호정책', required: true },
    { key: 'marketing', label: '맞춤형 광고 안내', required: false },
  ];

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden p-6">
      <header className="h-14 flex items-center shrink-0 mb-4">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-xl font-bold ml-1">회원가입</h1>
      </header>
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-1">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-10">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-brand-DEFAULT mb-2">계정 만들기</h2>
            <p className="text-[#8E8E93] text-sm">서비스 이용을 위한 계정을 생성합니다.</p>
          </div>

          <div className="mb-6">
            <button
              type="button"
              onClick={handleAppleLogin}
              disabled={isAppleLoading}
              className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold py-3.5 rounded-2xl hover:bg-gray-100 transition-colors shadow-lg active:scale-[0.98]"
            >
              {isAppleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.63-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.74s2.57-.99 4.31-.82c.51.03 2.26.2 3.32 1.73-3.03 1.76-2.39 5.51.64 6.77-.52 1.55-1.25 3.09-2.35 4.55zM12.03 7.25c-.25-2.19 1.62-3.99 3.63-4.25.32 2.45-2.38 4.23-3.63 4.25z"/>
                  </svg>
                  Apple로 계속하기
                </>
              )}
            </button>
            
            <div className="flex items-center gap-3 my-6">
              <div className="h-[1px] bg-[#3A3A3C] flex-1" />
              <span className="text-xs text-[#636366]">또는 이메일로 가입</span>
              <div className="h-[1px] bg-[#3A3A3C] flex-1" />
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleCreateAccount}>
            <div className="space-y-4">
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
                    placeholder="실명으로 입력해 주세요" 
                    className="bg-transparent text-white text-sm w-full focus:outline-none" 
                  />
                </div>
              </div>

              {/* [추가] 전화번호 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">전화번호</label>
                <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                  <Phone className="w-5 h-5 text-[#636366] mr-3" />
                  <input 
                    name="phone" 
                    type="tel" 
                    value={accountData.phone} 
                    onChange={(e) => setAccountData({ ...accountData, phone: e.target.value.replace(/[^0-9]/g, '') })} 
                    placeholder="01012345678" 
                    className="bg-transparent text-white text-sm w-full focus:outline-none" 
                  />
                </div>
              </div>

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
                    className="bg-transparent text-white text-sm w-full focus:outline-none" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호</label>
                <div className={`flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border transition-colors ${
                  passwordError && accountData.password ? 'border-red-500' : 
                  isPasswordValid ? 'border-green-500' : 
                  'border-[#3A3A3C] focus-within:border-brand-DEFAULT'
                }`}>
                  <Lock className="w-5 h-5 text-[#636366] mr-3" />
                  <input 
                    name="password" 
                    type={showPassword ? 'text' : 'password'} 
                    value={accountData.password} 
                    onChange={handleAccountChange} 
                    placeholder="8자리 이상, 대소문자/숫자/특수문자 포함" 
                    className="bg-transparent text-white text-sm w-full focus:outline-none" 
                  />
                  <div className="flex items-center gap-2 ml-2">
                    {accountData.password && (
                      <button
                        type="button"
                        onClick={() => setAccountData({ ...accountData, password: '', confirmPassword: '' })}
                        className="text-[#636366] hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-[#636366] hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호 확인</label>
                <div className={`flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border transition-colors ${
                  confirmPasswordError && accountData.confirmPassword ? 'border-red-500' : 
                  isConfirmPasswordValid ? 'border-green-500' : 
                  'border-[#3A3A3C] focus-within:border-brand-DEFAULT'
                }`}>
                  <Lock className="w-5 h-5 text-[#636366] mr-3" />
                  <input 
                    name="confirmPassword" 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    value={accountData.confirmPassword} 
                    onChange={handleAccountChange} 
                    placeholder="비밀번호 재입력" 
                    className="bg-transparent text-white text-sm w-full focus:outline-none" 
                  />
                  <div className="flex items-center gap-2 ml-2">
                    {accountData.confirmPassword && (
                      <button
                        type="button"
                        onClick={() => setAccountData({ ...accountData, confirmPassword: '' })}
                        className="text-[#636366] hover:text-white transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="text-[#636366] hover:text-white transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <div 
                className="flex items-center justify-between p-4 bg-[#2C2C2E] rounded-2xl border border-[#3A3A3C] cursor-pointer" 
                onClick={handleAllAgree}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    Object.values(agreedTerms).every(v => v) ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
                  }`}>
                    <Check className={`w-4 h-4 ${
                      Object.values(agreedTerms).every(v => v) ? 'text-white' : 'text-[#636366]'
                    }`} />
                  </div>
                  <span className="font-bold text-sm text-white">약관 전체동의</span>
                </div>
              </div>
              <div className="space-y-3 px-1">
                {termList.map((term) => (
                  <div key={term.key} className="flex items-center justify-between group">
                    <div 
                      className="flex items-center gap-3 cursor-pointer" 
                      onClick={() => handleTermToggle(term.key as keyof typeof agreedTerms)}
                    >
                      <Check className={`w-5 h-5 transition-colors ${
                        agreedTerms[term.key as keyof typeof agreedTerms] ? 'text-brand-DEFAULT' : 'text-[#3A3A3C]'
                      }`} />
                      <span className="text-sm text-[#8E8E93] group-hover:text-white transition-colors">
                        {term.label} <span className={term.required ? 'text-brand-DEFAULT' : 'text-[#636366]'}>
                          ({term.required ? '필수' : '선택'})
                        </span>
                      </span>
                    </div>
                    <button type="button" onClick={() => handleOpenPolicy(term.key)} className="p-1 text-[#636366] hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading || !isRequiredAgreed || !isPasswordValid || !isConfirmPasswordValid || !accountData.phone} 
              className={`w-full py-4 font-bold rounded-2xl mt-4 transition-all shadow-lg flex items-center justify-center gap-2 ${
                isRequiredAgreed && isPasswordValid && isConfirmPasswordValid && accountData.phone
                  ? 'bg-brand-DEFAULT text-white hover:bg-brand-hover' 
                  : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed border border-[#3A3A3C]'
              }`}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '다음 (본인인증)'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}