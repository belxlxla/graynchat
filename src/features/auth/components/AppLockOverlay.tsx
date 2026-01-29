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
    <div className="fixed inset-0 z-[9999] bg-[#0A0A0B] flex flex-col items-center justify-between py-24 px-8 select-none">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center text-center z-10">
        <div className={`w-20 h-20 rounded-[28px] flex items-center justify-center mb-6 border transition-colors duration-300 ${isError ? 'bg-[#EC5022]/10 border-[#FF453A]/30' : 'bg-[#1C1C1E] border-white/5 shadow-xl'}`}>
          <ShieldAlert size={36} className={isError ? "text-[#EC5022]" : "text-brand-DEFAULT"} />
        </div>
        <h2 className="text-xl font-bold text-white tracking-widest uppercase">Security</h2>
        <p className={`text-[13px] mt-2 transition-colors duration-300 ${isError ? "text-[#EC5022] font-bold" : "text-[#636366]"}`}>
          {isError ? "암호가 올바르지 않습니다" : `입력 오류 횟수 (${failCount}/10)`}
        </p>
      </motion.div>

      <motion.div animate={isError ? { x: [-5, 5, -5, 5, 0] } : {}} transition={{ duration: 0.4 }} className="flex gap-8 z-10">
        {[...Array(4)].map((_, i) => (
          <motion.div 
            key={i} 
            animate={{ 
              scale: i < pin.length ? 1.2 : 1, 
              backgroundColor: i < pin.length ? (isError ? "#EC5022" : "#FFFFFF") : "#2C2C2E" 
            }} 
            className="w-3 h-3 rounded-full" 
          />
        ))}
      </motion.div>

      <div className="w-full max-w-[300px] grid grid-cols-3 gap-y-10 z-10">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
          <div key={n} className={`${n === 0 ? 'col-start-2' : ''} flex justify-center`}>
            <button 
              onClick={() => handlePress(n)} 
              disabled={isError} 
              className="relative w-16 h-16 flex items-center justify-center active:scale-90 transition-transform"
            >
              <motion.div 
                animate={{ opacity: noiseKeys.includes(n) ? 1 : 0 }} 
                className="absolute inset-0 bg-white/5 rounded-full" 
              />
              <span className="text-3xl font-medium text-white">{n}</span>
            </button>
          </div>
        ))}
        <div className="col-start-3 row-start-4 flex justify-center items-center">
          <button onClick={() => setPin(prev => prev.slice(0, -1))} className="text-[#48484A] active:text-white transition-colors">
            <Delete size={28} />
          </button>
        </div>
      </div>

      <div className="h-10 z-10">
        {getLockSettings().isBioEnabled && !isError && (
          <button onClick={triggerBiometric} className="flex items-center gap-2 px-6 py-2 bg-[#1C1C1E] border border-white/5 rounded-xl text-brand-DEFAULT font-bold text-xs active:scale-95 transition-all">
            <ScanFace size={16} /> 생체인증 재시도
          </button>
        )}
      </div>

      <AnimatePresence>
        {showBlockedModal && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center px-8">
            <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[#1C1C1E] border border-[#2C2C2E] p-10 rounded-[32px] text-center w-full max-w-[340px] shadow-2xl">
              <div className="w-16 h-16 bg-[#EC5022]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} className="text-[#EC5022]" />
              </div>
              <h3 className="text-xl font-bold text-white mb-3">접속 차단됨</h3>
              <p className="text-[13px] text-[#8E8E93] leading-relaxed mb-10">비밀번호 10회 입력 오류로 인하여<br/>사용자 보호를 위해 접속이 영구 차단되었습니다.</p>
              <a href="mailto:support@grayn.com" className="flex items-center justify-center gap-3 w-full py-4 bg-brand-DEFAULT text-white font-bold rounded-2xl active:scale-95 transition-all">
                <Mail size={18} /> 지원팀에 이메일 문의
              </a>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}