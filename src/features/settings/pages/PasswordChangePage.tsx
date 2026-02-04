import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
// ✨ 에러 수정: 사용하지 않는 Lock, CheckCircle2, ExternalLink 임포트 제거
import { ChevronLeft, Eye, EyeOff, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function PasswordChangePage() {
  const navigate = useNavigate();
  const [provider, setProvider] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form States
  // ✨ 에러 수정: 읽기 작업이 없는 currentPassword 변수와 setter 제거
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    const checkProvider = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // 간편로그인 플랫폼 확인 (google, kakao, naver, apple 등)
        setProvider(session.user.app_metadata.provider || 'email');
      }
      setIsLoading(false);
    };
    checkProvider();
  }, []);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error('새 비밀번호가 일치하지 않습니다.');
    }
    if (newPassword.length < 6) {
      return toast.error('비밀번호는 최소 6자 이상이어야 합니다.');
    }

    const loadingToast = toast.loading('비밀번호 변경 중...');
    try {
      // Supabase 비밀번호 업데이트 API
      const { error } = await supabase.auth.updateUser({ 
        password: newPassword 
      });

      if (error) throw error;

      toast.success('비밀번호가 안전하게 변경되었습니다.', { id: loadingToast });
      navigate(-1);
    } catch (error: any) {
      toast.error(error.message || '변경에 실패했습니다.', { id: loadingToast });
    }
  };

  if (isLoading) return <div className="h-screen bg-dark-bg" />;

  // ✨ 간편 로그인 유저인 경우 안내 화면 노출
  if (provider && provider !== 'email') {
    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    return (
      <div className="flex flex-col h-[100dvh] bg-dark-bg text-white font-sans">
        <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
          <button onClick={() => navigate(-1)} className="p-2 text-white"><ChevronLeft size={28} /></button>
          <h1 className="text-lg font-bold ml-1">비밀번호 변경</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <div className="w-20 h-20 bg-brand-DEFAULT/10 rounded-[28px] flex items-center justify-center mb-8 border border-brand-DEFAULT/20">
            <AlertCircle size={40} className="text-brand-DEFAULT" />
          </div>
          <h2 className="text-2xl font-black mb-4">플랫폼 계정 안내</h2>
          <p className="text-[#8E8E93] leading-relaxed mb-10">
            회원님은 <span className="text-white font-bold">{providerName}</span> 계정을 통해<br/>간편 로그인을 이용 중입니다.<br/><br/>
            비밀번호 변경은 해당 서비스 사이트의<br/>계정 설정에서 진행해 주세요.
          </p>
          <button 
            onClick={() => navigate(-1)}
            className="w-full py-5 bg-[#2C2C2E] text-white font-bold rounded-2xl active:scale-95 transition-all"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white font-sans">
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft size={28} />
        </button>
        <h1 className="text-lg font-bold ml-1">비밀번호 변경</h1>
      </header>

      <form onSubmit={handlePasswordChange} className="flex-1 overflow-y-auto px-6 py-10 space-y-8">
        <div className="space-y-2 text-center pb-4">
          <h2 className="text-xl font-bold">새로운 비밀번호 설정</h2>
          <p className="text-sm text-[#8E8E93]">주기적인 비밀번호 변경으로 계정을 보호하세요</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#636366] ml-1 uppercase tracking-widest">New Password</label>
            <div className="relative">
              <input 
                type={showPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 입력"
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl px-5 py-4 focus:border-brand-DEFAULT focus:outline-none transition-all"
                required
              />
              <button 
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#48484A]"
              >
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-[#636366] ml-1 uppercase tracking-widest">Confirm Password</label>
            <input 
              type={showPw ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="새 비밀번호 다시 입력"
              className={`w-full bg-[#1C1C1E] border rounded-2xl px-5 py-4 focus:outline-none transition-all ${
                confirmPassword && newPassword !== confirmPassword ? 'border-[#FF203A]' : 'border-[#2C2C2E] focus:border-brand-DEFAULT'
              }`}
              required
            />
            <AnimatePresence>
              {confirmPassword && newPassword !== confirmPassword && (
                <motion.p 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-xs text-[#FF203A] ml-1 mt-1 font-medium"
                >
                  비밀번호가 일치하지 않습니다.
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <button 
          type="submit"
          disabled={!newPassword || newPassword !== confirmPassword}
          className="w-full py-5 bg-brand-DEFAULT text-white font-black text-lg rounded-3xl shadow-lg shadow-brand-DEFAULT/20 disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
        >
          비밀번호 변경 완료
        </button>
      </form>
    </div>
  );
}