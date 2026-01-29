import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, Mail, Lock, User, Loader2, 
  Check, ChevronRight 
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

  // 약관 상태 관리
  const [agreedTerms, setAgreedTerms] = useState({
    service: false,      // 이용약관 (필수)
    location: false,     // 위치기반서비스 이용약관 (필수)
    privacy: false,      // 개인정보처리방침 (필수)
    sensitive: false,    // 민감정보 수집 및 이용 동의 (필수)
    operation: false,    // 운영정책 (필수)
    youth: false,        // 청소년보호정책 (필수)
    marketing: false,    // 맞춤형 광고 안내 (선택)
  });

  // 약관별 노션 링크
  const policyLinks: Record<string, string> = {
    service: 'https://www.notion.so',
    location: 'https://www.notion.so',
    privacy: 'https://www.notion.so',
    sensitive: 'https://www.notion.so',
    operation: 'https://www.notion.so',
    youth: 'https://www.notion.so',
    marketing: 'https://www.notion.so',
  };

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountData({ ...accountData, [e.target.name]: e.target.value });
  };

  // 전체 동의 핸들러
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

  // 개별 동의 핸들러
  const handleTermToggle = (key: keyof typeof agreedTerms) => {
    setAgreedTerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // 약관 상세 보기 핸들러
  const handleOpenPolicy = (key: string) => {
    const url = policyLinks[key];
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // 필수 약관 동의 여부 확인
  const isRequiredAgreed = useMemo(() => {
    return agreedTerms.service && 
           agreedTerms.location && 
           agreedTerms.privacy && 
           agreedTerms.sensitive && 
           agreedTerms.operation && 
           agreedTerms.youth;
  }, [agreedTerms]);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountData.name) return toast.error('이름을 입력해주세요.');
    if (!accountData.email || !accountData.password) return toast.error('이메일과 비밀번호를 입력해주세요.');
    if (accountData.password !== accountData.confirmPassword) return toast.error('비밀번호가 일치하지 않습니다.');
    if (accountData.password.length < 6) return toast.error('비밀번호는 6자리 이상이어야 합니다.');
    if (!isRequiredAgreed) return toast.error('필수 약관에 동의해 주세요.');

    setIsLoading(true);
    try {
      // 1. Supabase Auth 계정 생성
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
        options: { 
          data: { 
            full_name: accountData.name 
          } 
        }
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        // 2. public.users 테이블에 추가 데이터 저장 (또는 업데이트)
        // 만약 트리거가 이미 생성했다면 그 위에 약관 동의 여부를 덮어씌웁니다.
        const { error: upsertError } = await supabase.from('users').upsert({
          id: data.user.id,
          email: accountData.email,
          name: accountData.name,
          status_message: '반가워요!',
          is_terms_agreed: true,
          is_marketing_agreed: agreedTerms.marketing,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'id'
        });

        if (upsertError) throw upsertError;

        toast.success('계정이 생성되었습니다. 본인인증을 진행합니다.');
        navigate('/auth/phone'); 
      } else if (!data.session) {
        toast('이메일 인증 링크를 보냈습니다. 확인해주세요.', { icon: '📧' });
      }
    } catch (error: any) {
      console.error('Signup Error:', error);
      // 구체적인 에러 메시지 처리
      if (error.message.includes('users')) {
        toast.error('데이터베이스 저장 중 오류가 발생했습니다. SQL 설정을 확인해 주세요.');
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
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-white hover:text-brand-DEFAULT transition-colors">
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
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">이름</label>
                <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                  <User className="w-5 h-5 text-[#636366] mr-3" />
                  <input name="name" type="text" value={accountData.name} onChange={handleAccountChange} placeholder="실명으로 입력해 주세요" className="bg-transparent text-white text-sm w-full focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">이메일</label>
                <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                  <Mail className="w-5 h-5 text-[#636366] mr-3" />
                  <input name="email" type="email" value={accountData.email} onChange={handleAccountChange} placeholder="example@grayn.com" className="bg-transparent text-white text-sm w-full focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호</label>
                <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                  <Lock className="w-5 h-5 text-[#636366] mr-3" />
                  <input name="password" type="password" value={accountData.password} onChange={handleAccountChange} placeholder="6자리 이상 입력" className="bg-transparent text-white text-sm w-full focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#8E8E93] ml-1">비밀번호 확인</label>
                <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                  <Lock className="w-5 h-5 text-[#636366] mr-3" />
                  <input name="confirmPassword" type="password" value={accountData.confirmPassword} onChange={handleAccountChange} placeholder="비밀번호 재입력" className="bg-transparent text-white text-sm w-full focus:outline-none" />
                </div>
              </div>
            </div>

            <div className="pt-4 space-y-4">
              <div className="flex items-center justify-between p-4 bg-[#2C2C2E] rounded-2xl border border-[#3A3A3C] cursor-pointer" onClick={handleAllAgree}>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${Object.values(agreedTerms).every(v => v) ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'}`}>
                    <Check className={`w-4 h-4 ${Object.values(agreedTerms).every(v => v) ? 'text-white' : 'text-[#636366]'}`} />
                  </div>
                  <span className="font-bold text-sm text-white">약관 전체동의</span>
                </div>
              </div>

              <div className="space-y-3 px-1">
                {termList.map((term) => (
                  <div key={term.key} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => handleTermToggle(term.key as keyof typeof agreedTerms)}>
                      <Check className={`w-5 h-5 transition-colors ${agreedTerms[term.key as keyof typeof agreedTerms] ? 'text-brand-DEFAULT' : 'text-[#3A3A3C]'}`} />
                      <span className="text-sm text-[#8E8E93] group-hover:text-white transition-colors">
                        {term.label} <span className={term.required ? 'text-brand-DEFAULT' : 'text-[#636366]'}>({term.required ? '필수' : '선택'})</span>
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

            <button 
              type="submit" 
              disabled={isLoading || !isRequiredAgreed} 
              className={`w-full py-4 font-bold rounded-2xl mt-4 transition-all shadow-lg flex items-center justify-center gap-2 
                ${isRequiredAgreed ? 'bg-brand-DEFAULT text-white hover:bg-brand-hover' : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed border border-[#3A3A3C]'}`}
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '다음 (본인인증)'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}