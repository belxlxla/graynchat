import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// ✨ 빌드 오류 수정을 위해 사용하지 않는 'Lock' 아이콘 임포트 제거
import { Delete, AlertTriangle, Mail, ScanFace, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function AppLockOverlay() {
  const [isLocked, setIsLocked] = useState(false);
  const [pin, setPin] = useState('');
  const [failCount, setFailCount] = useState(() => Number(localStorage.getItem('grayn_fail_count')) || 0);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [isError, setIsError] = useState(false);
  const [noiseKeys, setNoiseKeys] = useState<number[]>([]);

  // 설정 실시간 확인 함수
  const getLockSettings = useCallback(() => {
    return {
      isLockEnabled: localStorage.getItem('grayn_lock_enabled') === 'true',
      isBioEnabled: localStorage.getItem('grayn_biometric_enabled') === 'true',
      savedPin: localStorage.getItem('grayn_lock_pin')
    };
  }, []);

  // 잠금 해제 실행
  const unlockApp = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('users').update({ fail_count: 0 }).eq('id', session.user.id);
    }
    setIsLocked(false);
    setPin('');
    setFailCount(0);
    localStorage.setItem('grayn_fail_count', '0');
    toast.success('보안 인증 성공');
  }, []);

  // 시스템 생체 인증 호출
  const triggerBiometric = useCallback(async () => {
    const { isBioEnabled } = getLockSettings();
    if (!isBioEnabled || failCount >= 10) return;
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const options: any = { publicKey: { challenge, rp: { name: "Grayn" }, user: { id: new Uint8Array(16), name: "user", displayName: "user" }, pubKeyCredParams: [{ alg: -7, type: "public-key" }], authenticatorSelection: { authenticatorAttachment: "platform" }, timeout: 60000 } };
      const credential = await navigator.credentials.get(options);
      if (credential) unlockApp();
    } catch (e) {
      console.log("Biometric auth cancelled or not supported");
    }
  }, [failCount, getLockSettings, unlockApp]);

  // ✨ 앱 구동 시점 및 가시성 변경 감지
  useEffect(() => {
    const { isLockEnabled, isBioEnabled } = getLockSettings();
    
    // 1. 초기 로드 시 잠금 체크 (앱을 완전히 껐다 켰을 때)
    if (isLockEnabled) {
      setIsLocked(true);
      if (isBioEnabled && failCount < 10) triggerBiometric();
    }

    // 2. 백그라운드 -> 포그라운드 전환 감지
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentSettings = getLockSettings();
        if (currentSettings.isLockEnabled) {
          setIsLocked(true);
          if (currentSettings.isBioEnabled && failCount < 10) triggerBiometric();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [getLockSettings, triggerBiometric, failCount]);

  // 번호 입력 처리
  const handlePress = async (num: number) => {
    if (failCount >= 10) return;
    if (pin.length < 4) {
      const randomNoises = [num];
      while(randomNoises.length < 3) {
        const r = Math.floor(Math.random() * 10);
        if(!randomNoises.includes(r)) randomNoises.push(r);
      }
      setNoiseKeys(randomNoises);
      setTimeout(() => setNoiseKeys([]), 150);

      const nextPin = pin + num;
      setPin(nextPin);

      if (nextPin.length === 4) {
        const { savedPin } = getLockSettings();
        if (String(nextPin) === String(savedPin)) {
          unlockApp();
        } else {
          setIsError(true);
          const newFails = failCount + 1;
          setFailCount(newFails);
          localStorage.setItem('grayn_fail_count', String(newFails));
          
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase.from('users').update({ fail_count: newFails }).eq('id', session.user.id);
          }

          if (newFails >= 10) setShowBlockedModal(true);
          setTimeout(() => { setPin(''); setIsError(false); }, 500);
        }
      }
    }
  };

  if (!isLocked) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-[#000000] text-white flex flex-col select-none overflow-hidden font-sans">
      {/* 상단 여백 및 상태 표시줄 고려 */}
      <div className="flex-1 flex flex-col justify-center items-center w-full max-w-md mx-auto px-6 relative">
        
        {/* 1. 헤더 영역 (아이콘 + 텍스트 + 도트) - 그룹화하여 중앙 배치 */}
        <div className="flex flex-col items-center gap-8 mb-12">
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }} 
              animate={{ opacity: 1, scale: 1 }} 
              className="relative"
            >
              <div className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isError ? 'bg-[#EC5022]/10 shadow-[0_0_30px_-5px_rgba(236,80,34,0.3)]' : 'bg-[#1C1C1E] border border-white/5 shadow-2xl'}`}>
                <ShieldAlert 
                  size={42} 
                  strokeWidth={1.5}
                  className={`transition-colors duration-300 ${isError ? "text-[#EC5022]" : "text-brand-DEFAULT"}`} 
                />
              </div>
            </motion.div>

            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold tracking-tight text-white">
                  App Locked
                </h2>
                <p className={`text-sm transition-colors duration-300 ${isError ? "text-[#FF203A] font-medium" : "text-[#8E8E93]"}`}>
                  {isError ? "암호가 올바르지 않습니다" : `비밀번호를 입력해주세요 (${failCount}/10)`}
                </p>
            </div>

            {/* 입력 도트 */}
            <motion.div 
              animate={isError ? { x: [-10, 10, -10, 10, 0] } : {}} 
              transition={{ duration: 0.4 }} 
              className="flex gap-6 mt-4"
            >
              {[...Array(4)].map((_, i) => (
                <motion.div 
                  key={i} 
                  initial={false}
                  animate={{ 
                    scale: i < pin.length ? 1 : 0.8,
                    backgroundColor: i < pin.length 
                      ? (isError ? "#FF203A" : "#FFFFFF") 
                      : "#2C2C2E",
                    opacity: i < pin.length ? 1 : 0.5
                  }} 
                  className="w-3.5 h-3.5 rounded-full shadow-inner" 
                />
              ))}
            </motion.div>
        </div>

        {/* 2. 키패드 영역 */}
        <div className="w-full px-6 mb-10">
          <div className="grid grid-cols-3 gap-x-6 gap-y-5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <div key={n} className="flex justify-center">
                <button 
                  onClick={() => handlePress(n)} 
                  disabled={isError} 
                  className="relative w-20 h-20 rounded-full flex items-center justify-center text-3xl font-light text-white hover:bg-white/10 active:bg-white/20 transition-all duration-150 outline-none"
                >
                  <motion.div 
                    animate={{ opacity: noiseKeys.includes(n) ? 1 : 0 }} 
                    className="absolute inset-0 bg-white/10 rounded-full" 
                  />
                  {n}
                </button>
              </div>
            ))}
            
            {/* 마지막 줄: 빈칸 / 0 / 삭제 */}
            <div className="flex justify-center items-center">
               {/* 빈 공간 (생체인증 버튼이 하단에 있으므로 여기는 비움) */}
            </div>

            <div className="flex justify-center">
               <button 
                  onClick={() => handlePress(0)} 
                  disabled={isError} 
                  className="relative w-20 h-20 rounded-full flex items-center justify-center text-3xl font-light text-white hover:bg-white/10 active:bg-white/20 transition-all duration-150 outline-none"
                >
                  <motion.div 
                    animate={{ opacity: noiseKeys.includes(0) ? 1 : 0 }} 
                    className="absolute inset-0 bg-white/10 rounded-full" 
                  />
                  0
                </button>
            </div>

            <div className="flex justify-center items-center">
              <button 
                onClick={() => setPin(prev => prev.slice(0, -1))} 
                className="w-20 h-20 flex items-center justify-center text-white/50 hover:text-white active:text-white transition-colors outline-none"
              >
                <Delete size={28} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* 3. 하단 기능 버튼 (생체인증) */}
        <div className="h-12 flex justify-center items-start">
           {getLockSettings().isBioEnabled && !isError && (
             <button 
               onClick={triggerBiometric} 
               className="flex items-center gap-2 px-5 py-2.5 rounded-full text-brand-DEFAULT text-sm font-bold active:bg-brand-DEFAULT/10 transition-colors"
             >
               <ScanFace size={18} />
               <span>Face ID 사용</span>
             </button>
           )}
        </div>
      </div>

      {/* 접속 차단 모달 */}
      <AnimatePresence>
        {showBlockedModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 10 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              className="relative bg-[#1C1C1E] border border-white/10 p-8 rounded-[32px] text-center w-full max-w-[320px] shadow-2xl overflow-hidden"
            >
              {/* 배경 효과 */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-[#FF203A]/20 blur-[60px] rounded-full pointer-events-none" />
              
              <div className="relative z-10">
                <div className="w-16 h-16 bg-[#FF203A]/10 rounded-full flex items-center justify-center mx-auto mb-5 border border-[#FF203A]/20">
                  <AlertTriangle size={32} className="text-[#FF203A]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">접속 차단됨</h3>
                <p className="text-[13px] text-[#8E8E93] leading-relaxed mb-8">
                  비밀번호 10회 입력 오류가 발생했습니다.<br/>
                  계정 보호를 위해 앱 접근이 제한됩니다.
                </p>
                <a 
                  href="mailto:support@grayn.com" 
                  className="flex items-center justify-center gap-2 w-full py-4 bg-brand-DEFAULT text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-brand-DEFAULT/20"
                >
                  <Mail size={18} /> 
                  <span>고객센터 문의하기</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}