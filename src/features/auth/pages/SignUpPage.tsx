import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, Mail, Lock, User, Loader2, 
  Check, ChevronRight, Eye, EyeOff, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function SignUpPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const [accountData, setAccountData] = useState({
    name: '',
    email: '',
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
    service: 'https://www.notion.so',
    location: 'https://www.notion.so',
    privacy: 'https://www.notion.so',
    sensitive: 'https://www.notion.so',
    operation: 'https://www.notion.so',
    youth: 'https://www.notion.so',
    marketing: 'https://www.notion.so',
  };

  // 비밀번호 유효성 검사
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
      
      if (accountData.confirmPassword) {
        if (value !== accountData.confirmPassword) {
          setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
        } else {
          setConfirmPasswordError('');
        }
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

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accountData.name.trim()) return toast.error('이름을 입력해주세요.');
    if (!accountData.email.trim()) return toast.error('이메일을 입력해주세요.');
    if (passwordError) return toast.error('비밀번호 요구사항을 충족해주세요.');
    if (!isPasswordValid) return toast.error('유효한 비밀번호를 입력해주세요.');
    if (!isConfirmPasswordValid) return toast.error('비밀번호가 일치하지 않습니다.');
    if (!isRequiredAgreed) return toast.error('필수 약관에 동의해 주세요.');

    setIsLoading(true);
    
    try {
      // 1단계: Supabase Auth 회원가입
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: accountData.email.trim(),
        password: accountData.password,
        options: { 
          data: { 
            full_name: accountData.name.trim() 
          }
        }
      });

      if (signUpError) {
        console.error('SignUp Error:', signUpError);
        throw signUpError;
      }

      if (!authData.user) {
        throw new Error('회원가입에 실패했습니다.');
      }

      // 2단계: users 테이블에 기본 정보만 저장 (phone, avatar, bg_image 제외)
      const { error: dbError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: accountData.email.trim(),
          name: accountData.name.trim(),
          is_terms_agreed: true,
          is_marketing_agreed: agreedTerms.marketing,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (dbError) {
        console.error('Database Error:', dbError);
        
        // users 테이블 삽입 실패 시 auth 사용자 삭제 시도
        await supabase.auth.admin.deleteUser(authData.user.id);
        
        throw new Error('데이터베이스 저장 중 오류가 발생했습니다.');
      }

      toast.success('계정이 생성되었습니다!');
      
      // 본인인증 페이지로 이동
      setTimeout(() => {
        navigate('/auth/phone');
      }, 500);

    } catch (error: any) {
      console.error('Signup Error:', error);
      
      if (error.message?.includes('already registered')) {
        toast.error('이미 가입된 이메일입니다.');
      } else if (error.message?.includes('Invalid email')) {
        toast.error('유효하지 않은 이메일 형식입니다.');
      } else if (error.message?.includes('Password')) {
        toast.error('비밀번호가 요구사항을 충족하지 않습니다.');
      } else {
        toast.error(error.message || '회원가입 중 오류가 발생했습니다.');
      }
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
                    className="bg-transparent text-white text-sm w-full focus:outline-none" 
                  />
                </div>
              </div>

              {/* 비밀번호 */}
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
                {passwordError && accountData.password && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-xs text-red-500 ml-1 mt-1"
                  >
                    {passwordError}
                  </motion.p>
                )}
                {isPasswordValid && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-xs text-green-500 ml-1 mt-1"
                  >
                    ✓ 안전한 비밀번호입니다.
                  </motion.p>
                )}
                {!accountData.password && (
                  <p className="text-xs text-[#636366] ml-1 mt-1">
                    • 8자리 이상 • 대문자 • 소문자 • 숫자 • 특수문자 포함
                  </p>
                )}
              </div>

              {/* 비밀번호 확인 */}
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
                {confirmPasswordError && accountData.confirmPassword && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-xs text-red-500 ml-1 mt-1"
                  >
                    {confirmPasswordError}
                  </motion.p>
                )}
                {isConfirmPasswordValid && (
                  <motion.p 
                    initial={{ opacity: 0, y: -5 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    className="text-xs text-green-500 ml-1 mt-1"
                  >
                    ✓ 비밀번호가 일치합니다.
                  </motion.p>
                )}
              </div>
            </div>

            {/* 약관 동의 */}
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
                    <button 
                      type="button" 
                      onClick={() => handleOpenPolicy(term.key)} 
                      className="p-1 text-[#636366] hover:text-white transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 제출 버튼 */}
            <button 
              type="submit" 
              disabled={isLoading || !isRequiredAgreed || !isPasswordValid || !isConfirmPasswordValid} 
              className={`w-full py-4 font-bold rounded-2xl mt-4 transition-all shadow-lg flex items-center justify-center gap-2 ${
                isRequiredAgreed && isPasswordValid && isConfirmPasswordValid
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