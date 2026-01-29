import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Mail, Lock, User, Loader2 } from 'lucide-react';
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

  const handleAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAccountData({ ...accountData, [e.target.name]: e.target.value });
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountData.name) return toast.error('이름을 입력해주세요.');
    if (!accountData.email || !accountData.password) return toast.error('이메일과 비밀번호를 입력해주세요.');
    if (accountData.password !== accountData.confirmPassword) return toast.error('비밀번호가 일치하지 않습니다.');
    if (accountData.password.length < 6) return toast.error('비밀번호는 6자리 이상이어야 합니다.');

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: accountData.email,
        password: accountData.password,
        options: { data: { full_name: accountData.name } }
      });

      if (error) throw error;

      if (data.user) {
        // public.users 테이블에 기본 데이터 생성
        await supabase.from('users').upsert([{
          id: data.user.id,
          email: accountData.email,
          name: accountData.name,
          status_message: '반가워요!'
        }]);

        toast.success('계정이 생성되었습니다. 본인인증을 진행합니다.');
        // ✨ [핵심 수정] 내부 step 변경이 아닌 실제 라우터 주소로 이동 (튕김 방지)
        navigate('/auth/phone'); 
      } else if (!data.session) {
        toast('이메일 인증 링크를 보냈습니다. 확인해주세요.', { icon: '📧' });
      }
    } catch (error: any) {
      console.error('Signup Error:', error);
      toast.error(error.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

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
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#8E8E93] ml-1">이름</label>
              <div className="flex items-center bg-[#2C2C2E] rounded-2xl px-4 py-3.5 border border-[#3A3A3C] focus-within:border-brand-DEFAULT transition-colors">
                <User className="w-5 h-5 text-[#636366] mr-3" />
                <input name="name" type="text" value={accountData.name} onChange={handleAccountChange} placeholder="실명 또는 닉네임" className="bg-transparent text-white text-sm w-full focus:outline-none" />
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

            <button type="submit" disabled={isLoading} className="w-full py-4 bg-brand-DEFAULT text-white font-bold rounded-2xl mt-8 hover:bg-brand-hover transition-colors shadow-lg flex items-center justify-center gap-2">
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : '다음 (본인인증)'}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}