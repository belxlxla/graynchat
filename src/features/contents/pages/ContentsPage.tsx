import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart2, Hourglass, Sparkles, Zap, Lock, Infinity, Check, Loader2, Crown, Star 
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';

export default function ContentsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'lab' | 'membership'>('lab');
  const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

  // [수정] ease: "easeOut" 뒤에 as const를 붙여 리터럴 타입으로 고정 (TypeScript 에러 해결)
  const fadeVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
    exit: { opacity: 0, transition: { duration: 0.2 } }
  };

  // --- [1. 단건 결제 핸들러 (리포트)] ---
  const handleOneTimePayment = () => {
    setIsPaymentProcessing(true);
    const platform = Capacitor.getPlatform();

    console.log(`[${platform}] 단건 결제 요청: report_unlock_2900`);

    setTimeout(() => {
      setIsPaymentProcessing(false);
      toast.success('리포트 잠금이 해제되었습니다!', {
        style: { background: '#333', color: '#fff', borderRadius: '10px' },
        icon: '🔓'
      });
      navigate('/main/contents/report');
    }, 1500);
  };

  // --- [2. 정기 구독 핸들러 (멤버십)] ---
  const handleSubscription = (planId: string, planName: string) => {
    setIsPaymentProcessing(true);
    const platform = Capacitor.getPlatform();

    console.log(`[${platform}] 구독 요청: ${planId}`);

    setTimeout(() => {
      setIsPaymentProcessing(false);
      
      toast.success(`${planName} 구독이 시작되었습니다!`, {
        style: { background: '#333', color: '#fff', borderRadius: '10px' },
        icon: '👑'
      });
    }, 2000);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#000000] text-white pb-32 scrollbar-hide relative">
      
      {/* 결제 로딩 오버레이 */}
      <AnimatePresence>
        {isPaymentProcessing && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-purple-500/30 blur-2xl rounded-full animate-pulse" />
              <Loader2 className="w-12 h-12 text-purple-500 animate-spin relative z-10" />
            </div>
            <h3 className="text-lg font-bold text-white mt-6">스토어 연결 중...</h3>
            <p className="text-xs text-gray-500 mt-2">안전하게 결제를 준비하고 있습니다.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 헤더 */}
      <header className="pt-safe-top px-5 pb-4 bg-[#000000]/80 backdrop-blur-xl sticky top-0 z-40 border-b border-white/5">
        <div className="flex items-center justify-between h-12 mb-4">
          <h1 className="text-2xl font-bold tracking-tight text-white">Store</h1>
        </div>
        <div className="relative flex bg-[#1C1C1E] p-1 rounded-xl h-11 border border-white/5">
          <motion.div 
            className="absolute top-1 bottom-1 bg-[#3A3A3C] rounded-lg shadow-md"
            initial={false}
            animate={{ left: activeTab === 'lab' ? '4px' : '50%', width: 'calc(50% - 4px)' }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
          <button onClick={() => setActiveTab('lab')} className={`flex-1 relative z-10 text-[13px] font-semibold transition-colors ${activeTab === 'lab' ? 'text-white' : 'text-[#8E8E93]'}`}>기능 실험실</button>
          <button onClick={() => setActiveTab('membership')} className={`flex-1 relative z-10 text-[13px] font-semibold transition-colors ${activeTab === 'membership' ? 'text-white' : 'text-[#8E8E93]'}`}>프리미엄 멤버십</button>
        </div>
      </header>

      <main className="px-5 pt-6">
        <AnimatePresence mode="wait">
          
          {/* === TAB 1: 기능 실험실 (리포트/타임캡슐) === */}
          {activeTab === 'lab' && (
            <motion.div key="lab" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-8">
              {/* 관계 분석 섹션 */}
              <section>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <BarChart2 className="w-4 h-4 text-purple-400" />
                  <h3 className="text-sm font-bold text-gray-300">관계 분석</h3>
                </div>
                
                <div className="bg-[#1C1C1E] rounded-2xl overflow-hidden border border-white/5 shadow-lg shadow-black/50">
                  <div className="p-6 pb-4">
                    <h2 className="text-lg font-bold text-white mb-2">우리 사이, 몇 점일까?</h2>
                    <p className="text-sm text-gray-400 leading-relaxed mb-6">
                      대화 패턴과 답장 시간을 AI가 정밀 분석해<br/>
                      보이지 않는 <span className="text-purple-400">감정 온도</span>를 수치로 보여줍니다.
                    </p>
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="bg-[#121212] p-4 rounded-xl border border-white/5 text-center">
                        <div className="text-[11px] text-gray-500 mb-1">감정 온도</div>
                        <div className="text-xl font-bold text-white">36.5°C</div>
                      </div>
                      <div className="bg-[#121212] p-4 rounded-xl border border-white/5 text-center">
                        <div className="text-[11px] text-gray-500 mb-1">핵심 키워드</div>
                        <div className="text-xl font-bold text-purple-400">설렘</div>
                      </div>
                    </div>
                  </div>

                  {/* 단건 결제 버튼 */}
                  <button 
                    onClick={handleOneTimePayment} 
                    className="w-full py-4 bg-[#2C2C2E] text-white text-sm font-bold border-t border-white/5 hover:bg-[#3A3A3C] transition-colors flex items-center justify-center gap-2 active:bg-[#444]"
                  >
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    2,900원으로 전체 리포트 열람
                  </button>
                </div>
              </section>

              {/* 타임 캡슐 섹션 */}
              <section>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Hourglass className="w-4 h-4 text-orange-400" />
                  <h3 className="text-sm font-bold text-gray-300">타임 캡슐</h3>
                </div>
                <div className="bg-[#1C1C1E] rounded-2xl overflow-hidden border border-white/5 p-6 shadow-lg shadow-black/50">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-lg font-bold text-white mb-1">미래로 보내는 편지</h2>
                      <p className="text-sm text-gray-400">지정한 날짜까지 절대 열리지 않습니다.</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-6">
                    {[
                      { label: '3일 뒤', price: '무료', icon: <Zap className="w-4 h-4 mb-2 text-gray-400" /> },
                      { label: '1년 뒤', price: '1,000원', icon: <Lock className="w-4 h-4 mb-2 text-orange-400" /> },
                      { label: '10년 뒤', price: '5,000원', icon: <Infinity className="w-4 h-4 mb-2 text-orange-400" /> },
                    ].map((item, idx) => (
                      <button key={idx} className="flex flex-col items-center justify-center py-4 bg-[#2C2C2E] rounded-xl border border-white/5 active:scale-95 transition-all hover:border-orange-500/50">
                        {item.icon}
                        <span className="text-xs font-medium text-gray-300 mb-0.5">{item.label}</span>
                        <span className="text-[11px] font-bold text-white">{item.price}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </motion.div>
          )}

          {/* === TAB 2: 프리미엄 멤버십 === */}
          {activeTab === 'membership' && (
            <motion.div key="membership" variants={fadeVariants} initial="hidden" animate="visible" exit="exit" className="space-y-6">
              
              {/* 1. 멤버십 헤더 */}
              <div className="text-center pt-2 pb-2">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-tr from-yellow-400 to-orange-500 rounded-full mb-3 shadow-[0_0_20px_rgba(251,191,36,0.4)]">
                  <Crown className="w-6 h-6 text-white fill-white" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Grain Premium</h2>
                <p className="text-sm text-gray-400">
                  모든 기능을 제한 없이.<br/>
                  더 깊은 관계를 위한 최고의 선택.
                </p>
              </div>

              {/* 2. 멤버십 플랜 리스트 */}
              <div className="space-y-4">
                
                {/* [BEST] 연간 플랜 */}
                <button 
                  onClick={() => handleSubscription('grain_yearly', '연간 멤버십')}
                  className="relative w-full p-1 rounded-3xl bg-gradient-to-r from-orange-500 via-red-500 to-purple-600 shadow-[0_0_20px_rgba(236,80,34,0.3)] active:scale-[0.98] transition-transform"
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-black px-3 py-1 rounded-full shadow-md z-10 uppercase tracking-wide flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" /> Best Value
                  </div>
                  <div className="w-full h-full bg-[#151515] rounded-[22px] p-5 flex items-center justify-between relative overflow-hidden">
                    {/* 배경 데코 */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 blur-[40px] rounded-full" />
                    
                    <div className="flex flex-col items-start z-10">
                      <span className="text-sm font-bold text-orange-400 mb-1">연간 멤버십</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl font-bold text-white">₩47,000</span>
                        <span className="text-sm text-gray-500 line-through">₩58,800</span>
                      </div>
                      <span className="text-[11px] text-gray-400 mt-2 bg-white/5 px-2 py-0.5 rounded-md">
                        월 3,900원 수준 (20% SAVE)
                      </span>
                    </div>
                    <div className="z-10">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-r from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                        <Check className="w-5 h-5 text-white stroke-[3]" />
                      </div>
                    </div>
                  </div>
                </button>

                {/* 월간 플랜 */}
                <button 
                  onClick={() => handleSubscription('grain_monthly', '월간 멤버십')}
                  className="w-full p-5 bg-[#1C1C1E] border border-white/5 rounded-3xl flex items-center justify-between active:bg-[#2C2C2E] transition-colors"
                >
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-medium text-gray-400">월간 멤버십</span>
                    <span className="text-xl font-bold text-white mt-1">₩4,900</span>
                  </div>
                  <div className="w-6 h-6 rounded-full border-2 border-[#3A3A3C]" />
                </button>
              </div>

              {/* 3. 혜택 그리드 */}
              <div className="bg-[#1C1C1E] rounded-3xl p-6 border border-white/5">
                <h4 className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-wider">PREMIUM BENEFITS</h4>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: Sparkles, text: "AI 분석 무제한" },
                    { icon: Infinity, text: "타임캡슐 무료" },
                    { icon: Zap, text: "광고 제거" },
                    { icon: Lock, text: "시크릿 채팅" }
                  ].map((item, i) => (
                    <div key={i} className="flex flex-col items-start gap-2 p-3 bg-[#121212] rounded-2xl border border-white/5">
                      <item.icon className="w-5 h-5 text-orange-400" />
                      <span className="text-xs font-medium text-gray-300">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. 유의사항 */}
              <div className="px-4 pb-8">
                <p className="text-[10px] text-center text-gray-600 leading-relaxed">
                  구독은 현재 기간이 종료되기 최소 24시간 전에 취소하지 않으면 자동으로 갱신됩니다. 
                  계정 설정에서 언제든지 구독을 취소할 수 있습니다.
                </p>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}