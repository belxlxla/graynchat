import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, ShieldCheck, 
  Key, History, Smartphone, AlertTriangle 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function AccountSecurityPage() {
  const navigate = useNavigate();

  // === States ===
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [securityScore, setSecurityScore] = useState(65);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSecurityStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('users')
          .select('is_2fa_enabled')
          .eq('id', session.user.id)
          .single();
        
        if (data) {
          setIs2FAEnabled(data.is_2fa_enabled);
          setSecurityScore(data.is_2fa_enabled ? 85 : 65);
        }
      }
      setIsLoading(false);
    };
    fetchSecurityStatus();
  }, []);

  const securityInfo = {
    level: securityScore >= 80 ? '양호' : '주의',
    lastPasswordChange: '2025.10.20',
    currentLocation: '대한민국 하남시'
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">보안 설정</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        <div className="px-5 py-6">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-[#1C1C1E] to-[#2C2C2E] rounded-[32px] p-7 border border-[#3A3A3C] shadow-2xl relative overflow-hidden"
          >
            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <div className={`w-2 h-2 rounded-full ${securityScore >= 80 ? 'bg-brand-DEFAULT' : 'bg-[#FF453A]'}`} />
                <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${securityScore >= 80 ? 'text-brand-DEFAULT' : 'text-[#FF453A]'}`}>Security Diagnosis</span>
              </div>
              
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black tracking-tight">보안 등급 {securityInfo.level}</h2>
                  <p className="text-sm text-[#8E8E93] mt-1">
                    {securityScore >= 80 ? '계정이 안전하게 보호되고 있습니다' : '2단계 인증을 설정하여 보안을 강화하세요'}
                  </p>
                </div>
                <div className="relative flex items-center justify-center">
                  <svg className="w-16 h-16 transform -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-[#2C2C2E]" />
                    <motion.circle 
                      cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="6" fill="transparent" 
                      strokeDasharray={175} 
                      animate={{ strokeDashoffset: 175 - (175 * securityScore) / 100 }}
                      className={`${securityScore >= 80 ? 'text-brand-DEFAULT' : 'text-[#FF453A]'} transition-all duration-1000`} 
                    />
                  </svg>
                  <span className="absolute text-sm font-black">{securityScore}</span>
                </div>
              </div>

              <button 
                onClick={() => toast.success('보안 정밀 진단을 시작합니다.')}
                className="w-full py-4 bg-brand-DEFAULT text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-brand-DEFAULT/20"
              >
                정밀 보안 진단하기
              </button>
            </div>
          </motion.div>
        </div>

        <div className="px-5 space-y-6">
          <section>
            <h3 className="text-[11px] font-bold text-[#636366] ml-2 mb-3 uppercase tracking-widest">Authentication</h3>
            <div className="bg-[#1C1C1E] rounded-3xl overflow-hidden border border-[#2C2C2E]">
              <SecurityItem 
                icon={<Smartphone className="w-5 h-5" />}
                title="2단계 인증 설정"
                desc="로그인 시 추가 보안 코드 확인"
                value={is2FAEnabled ? "설정됨" : "미설정"}
                valueColor={is2FAEnabled ? "text-brand-DEFAULT" : "text-[#FF453A]"}
                onClick={() => navigate('/settings/security/2fa')}
              />
              <div className="h-[1px] bg-[#2C2C2E] mx-5" />
              {/* ✨ 비밀번호 변경 페이지로 이동 연동 */}
              <SecurityItem 
                icon={<Key className="w-5 h-5" />}
                title="비밀번호 변경"
                desc={`마지막 변경: ${securityInfo.lastPasswordChange}`}
                onClick={() => navigate('/settings/security/password')}
              />
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-bold text-[#636366] ml-2 mb-3 uppercase tracking-widest">Access</h3>
            <div className="bg-[#1C1C1E] rounded-3xl overflow-hidden border border-[#2C2C2E]">
              <SecurityItem 
                icon={<History className="w-5 h-5" />}
                title="로그인 기기 관리"
                desc={`최근: ${securityInfo.currentLocation}`}
                onClick={() => navigate('/settings/security/manage')}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SecurityItem({ icon, title, desc, value, valueColor, onClick }: any) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-5 py-5 hover:bg-white/5 active:bg-white/10 transition-all text-left">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#2C2C2E] flex items-center justify-center text-[#8E8E93]">
          {icon}
        </div>
        <div>
          <h4 className="text-[15px] font-bold text-white">{title}</h4>
          <p className="text-xs text-[#8E8E93] mt-0.5">{desc}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className={`text-[12px] font-bold ${valueColor}`}>{value}</span>}
        <ChevronRight className="w-4 h-4 text-[#48484A]" />
      </div>
    </button>
  );
}