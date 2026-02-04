import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Mail, Smartphone, CheckCircle2, 
  AlertTriangle, ShieldCheck 
  // ✨ 에러 수정: 사용하지 않는 X, ArrowRight 임포트 제거
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function TwoFactorAuthPage() {
  const navigate = useNavigate();
  const [isEnabled, setIsEnabled] = useState(false);
  const [method, setMethod] = useState<'email' | 'phone'>('email');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // ✨ 에러 수정: 사용하지 않는 isLoading 상태 제거

  useEffect(() => {
    const loadStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase.from('users').select('is_2fa_enabled, mfa_method').eq('id', session.user.id).single();
        if (data) {
          setIsEnabled(data.is_2fa_enabled);
          setMethod(data.mfa_method || 'email');
        }
      }
    };
    loadStatus();
  }, []);

  const handleToggle2FA = async () => {
    if (isEnabled) {
      setShowConfirmModal(true);
    } else {
      update2FA(true, method);
    }
  };

  const update2FA = async (enable: boolean, targetMethod: 'email' | 'phone') => {
    const loadingToast = toast.loading('설정 변경 중...');
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      const { error } = await supabase
        .from('users')
        .update({ is_2fa_enabled: enable, mfa_method: targetMethod })
        .eq('id', session.user.id);

      if (!error) {
        setIsEnabled(enable);
        setMethod(targetMethod);
        toast.success(enable ? '2단계 인증이 활성화되었습니다.' : '2단계 인증이 해제되었습니다.', { id: loadingToast });
        setShowConfirmModal(false);
      } else {
        toast.error('설정 저장 실패', { id: loadingToast });
      }
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden font-sans">
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">2단계 인증 설정</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-8">
        <div className="flex flex-col items-center text-center mb-12">
          <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center mb-6 transition-colors duration-500 ${isEnabled ? 'bg-brand-DEFAULT/10 border border-brand-DEFAULT/20 shadow-[0_0_30px_rgba(var(--brand-rgb),0.1)]' : 'bg-[#2C2C2E]'}`}>
            {isEnabled ? <ShieldCheck size={40} className="text-brand-DEFAULT" /> : <Smartphone size={40} className="text-[#8E8E93]" />}
          </div>
          <h2 className="text-2xl font-black mb-3">계정을 더 안전하게</h2>
          <p className="text-[#8E8E93] text-[14px] leading-relaxed">
            새로운 기기에서 로그인 시<br/>설정하신 인증 수단으로 코드가 발송됩니다.
          </p>
        </div>

        <div className="space-y-4">
          <div className={`p-6 rounded-[32px] border transition-all duration-300 ${isEnabled ? 'bg-brand-DEFAULT/5 border-brand-DEFAULT/30' : 'bg-[#2C2C2E] border-transparent opacity-50 pointer-events-none'}`}>
            <h3 className="text-xs font-black text-brand-DEFAULT mb-4 tracking-widest uppercase">Select Method</h3>
            <div className="space-y-3">
              <MethodItem 
                icon={<Mail size={20} />} 
                label="이메일로 받기" 
                desc="4자리 보안 코드 발송" 
                active={method === 'email'} 
                onClick={() => isEnabled && update2FA(true, 'email')} 
              />
              <MethodItem 
                icon={<Smartphone size={20} />} 
                label="휴대폰 문자로 받기" 
                desc="가입된 번호로 SMS 발송" 
                active={method === 'phone'} 
                onClick={() => isEnabled && update2FA(true, 'phone')} 
              />
            </div>
          </div>

          <button 
            onClick={handleToggle2FA}
            className={`w-full py-5 rounded-3xl font-black text-lg transition-all active:scale-[0.98] shadow-2xl ${isEnabled ? 'bg-[#2C2C2E] text-[#FF203A] border border-[#FF203A]/20' : 'bg-brand-DEFAULT text-white shadow-brand-DEFAULT/20'}`}
          >
            {isEnabled ? '2단계 인증 해제하기' : '2단계 인증 사용하기'}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => setShowConfirmModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] border border-[#2C2C2E] rounded-[40px] p-8 text-center shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
              <div className="w-16 h-16 bg-[#FF203A]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} className="text-[#FF203A]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3 tracking-tight">보안 등급이 낮아집니다</h3>
              <p className="text-[13px] text-[#8E8E93] leading-relaxed mb-8">
                2단계 인증을 해제하면 외부 위협에<br/>취약해질 수 있습니다. 정말 해제할까요?
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-4 bg-[#2C2C2E] text-white font-bold rounded-2xl active:scale-95 transition-all">취소</button>
                <button onClick={() => update2FA(false, method)} className="flex-1 py-4 bg-[#FF203A] text-white font-bold rounded-2xl active:scale-95 transition-all">해제하기</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MethodItem({ icon, label, desc, active, onClick }: any) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${active ? 'bg-brand-DEFAULT text-white' : 'bg-[#1C1C1E] text-[#8E8E93] hover:bg-white/5'}`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${active ? 'bg-white/20' : 'bg-[#2C2C2E]'}`}>{icon}</div>
        <div className="text-left">
          <p className="text-[14px] font-bold">{label}</p>
          <p className={`text-[11px] ${active ? 'text-white/70' : 'text-[#636366]'}`}>{desc}</p>
        </div>
      </div>
      {active ? <CheckCircle2 size={20} className="fill-white text-brand-DEFAULT" /> : <div className="w-5 h-5 rounded-full border-2 border-[#3A3A3C]" />}
    </button>
  );
}