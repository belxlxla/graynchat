import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, AlertTriangle, CheckCircle2, Circle, Heart } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function WithdrawPage() {
  const navigate = useNavigate();
  const [checks, setChecks] = useState({ data: false, friend: false, files: false });
  const [confirmText, setConfirmText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const isAllChecked = checks.data && checks.friend && checks.files;
  const isFinalValid = isAllChecked && confirmText === '탈퇴하겠습니다';

  const handleWithdraw = async () => {
    if (!isFinalValid || isProcessing) return;
    setIsProcessing(true);

    try {
      // 1. Supabase RPC 함수 호출 (실제 계정 삭제 실행)
      const { error: rpcError } = await supabase.rpc('delete_user_account');
      
      if (rpcError) {
        console.error('RPC Error:', rpcError);
        // 만약 CASCADE 설정이 안되어 23503 에러가 나면 여기서 잡힘
        if (rpcError.code === '23503') {
          toast.error('삭제되지 않은 데이터가 있어 탈퇴가 중단되었습니다.');
        } else {
          toast.error('탈퇴 처리 중 오류가 발생했습니다.');
        }
        setIsProcessing(false);
        return;
      }

      // 2. 계정 삭제 성공 시 세션 즉시 만료 (로그아웃 처리)
      await supabase.auth.signOut();
      
      // 3. 완료 모달 띄우기
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error('Withdraw Logic Error:', err);
      toast.error('연결 상태를 확인해 주세요.');
      setIsProcessing(false);
    }
  };

  const handleFinalExit = () => {
    // 4. 확인 버튼 클릭 시 모든 로컬 상태를 날리고 초기 화면으로 강제 이동
    window.location.href = '/'; 
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden font-sans">
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 text-white"><ChevronLeft className="w-7 h-7" /></button>
        <h1 className="text-lg font-bold ml-1">회원 탈퇴</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-8 custom-scrollbar">
        <div className="mb-10">
          <div className="w-16 h-16 bg-[#EC5022]/10 rounded-2xl flex items-center justify-center mb-6 border border-[#EC5022]/20">
            <AlertTriangle className="w-8 h-8 text-[#EC5022]" />
          </div>
          <h2 className="text-2xl font-black tracking-tight mb-3">떠나신다니 아쉬워요.</h2>
          <p className="text-[#8E8E93] text-[14px] leading-relaxed">
            탈퇴하시기 전, 아래 유의사항을 반드시 확인해 주세요.<br/>
            한 번 삭제된 계정은 어떠한 방법으로도 복구되지 않습니다.
          </p>
        </div>

        <div className="space-y-4 mb-10">
          <CheckItem 
            label="모든 개인 데이터가 삭제됩니다." 
            desc="프로필 정보, 설정, 계정 기록 등 그레인에 저장된 모든 정보가 즉시 파기됩니다." 
            checked={checks.data} 
            onClick={() => setChecks({ ...checks, data: !checks.data })}
          />
          <CheckItem 
            label="친구 목록에서 내 정보가 사라집니다." 
            desc="상대방의 친구 목록에서 회원님이 삭제되며, 더 이상 대화를 주고받을 수 없습니다." 
            checked={checks.friend} 
            onClick={() => setChecks({ ...checks, friend: !checks.friend })}
          />
          <CheckItem 
            label="주고받은 사진과 파일이 모두 사라집니다." 
            desc="채팅방에서 공유했던 모든 미디어 파일은 서버에서 영구 삭제되어 다시 볼 수 없습니다." 
            checked={checks.files} 
            onClick={() => setChecks({ ...checks, files: !checks.files })}
          />
        </div>

        {isAllChecked && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 text-center">
              <p className="text-xs text-[#8E8E93] mb-3">최종 확인을 위해 아래 문구를 정확히 입력해 주세요.</p>
              <h4 className="text-white font-bold mb-4 text-lg">탈퇴하겠습니다</h4>
              <input 
                type="text" 
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="문구를 입력하세요"
                className="w-full bg-[#2C2C2E] border border-[#3A3A3C] rounded-xl px-4 py-3.5 text-center text-white focus:outline-none focus:border-[#EC5022] transition-all"
              />
            </div>
            <button 
              onClick={handleWithdraw}
              disabled={!isFinalValid || isProcessing}
              className={`w-full py-5 rounded-2xl font-black text-lg transition-all ${
                isFinalValid ? 'bg-[#EC5022] text-white shadow-lg shadow-[#EC5022]/20 active:scale-95' : 'bg-[#2C2C2E] text-[#48484A] cursor-not-allowed'
              }`}
            >
              {isProcessing ? '처리 중...' : '그레인 계정 삭제'}
            </button>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
              className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] border border-[#2C2C2E] rounded-[40px] p-10 text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center mx-auto mb-8">
                <Heart className="w-10 h-10 text-brand-DEFAULT" />
              </div>
              <h3 className="text-2xl font-black text-white mb-4">탈퇴 완료</h3>
              <p className="text-[14px] text-[#8E8E93] leading-relaxed mb-10">
                그동안 그레인을 이용해 주셔서 감사합니다.<br/>더 나은 서비스로 다시 만날 날을 기다리겠습니다.
              </p>
              <button 
                onClick={handleFinalExit}
                className="w-full py-5 bg-brand-DEFAULT text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg"
              >
                확인
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckItem({ label, desc, checked, onClick }: any) {
  return (
    <div onClick={onClick} className={`p-5 rounded-2xl border transition-all cursor-pointer ${checked ? 'bg-white/5 border-white/10' : 'bg-[#2C2C2E] border-transparent'}`}>
      <div className="flex items-start gap-4">
        <div className="mt-0.5">{checked ? <CheckCircle2 className="w-5 h-5 text-brand-DEFAULT" /> : <Circle className="w-5 h-5 text-[#48484A]" />}</div>
        <div>
          <h4 className={`text-[15px] font-bold mb-1 ${checked ? 'text-white' : 'text-[#8E8E93]'}`}>{label}</h4>
          <p className="text-[12px] text-[#636366] leading-relaxed">{desc}</p>
        </div>
      </div>
    </div>
  );
}