import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  const getLockSettings = useCallback(() => ({
    isLockEnabled: localStorage.getItem('grayn_lock_enabled') === 'true',
    isBioEnabled: localStorage.getItem('grayn_biometric_enabled') === 'true',
    savedPin: localStorage.getItem('grayn_lock_pin'),
  }), []);

  const unlockApp = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('user_security').update({ fail_count: 0 }).eq('user_id', session.user.id);
    }
    setIsLocked(false);
    setPin('');
    setFailCount(0);
    localStorage.setItem('grayn_fail_count', '0');
    toast.success('보안 인증 성공');
  }, []);

  const triggerBiometric = useCallback(async () => {
    const { isBioEnabled } = getLockSettings();
    if (!isBioEnabled || failCount >= 10) return;
    try {
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);
      const options: any = {
        publicKey: {
          challenge,
          rp: { name: 'Grayn' },
          user: { id: new Uint8Array(16), name: 'user', displayName: 'user' },
          pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
          authenticatorSelection: { authenticatorAttachment: 'platform' },
          timeout: 60000,
        },
      };
      const credential = await navigator.credentials.get(options);
      if (credential) unlockApp();
    } catch {
      console.log('Biometric auth cancelled or not supported');
    }
  }, [failCount, getLockSettings, unlockApp]);

  useEffect(() => {
    const { isLockEnabled, isBioEnabled } = getLockSettings();
    if (isLockEnabled) {
      setIsLocked(true);
      if (isBioEnabled && failCount < 10) triggerBiometric();
    }
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const s = getLockSettings();
        if (s.isLockEnabled) {
          setIsLocked(true);
          if (s.isBioEnabled && failCount < 10) triggerBiometric();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [getLockSettings, triggerBiometric, failCount]);

  const handlePress = async (num: number) => {
    if (failCount >= 10) return;
    if (pin.length < 4) {
      const randomNoises = [num];
      while (randomNoises.length < 3) {
        const r = Math.floor(Math.random() * 10);
        if (!randomNoises.includes(r)) randomNoises.push(r);
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
            await supabase.from('user_security').update({ fail_count: newFails }).eq('user_id', session.user.id);
          }
          if (newFails >= 10) setShowBlockedModal(true);
          setTimeout(() => { setPin(''); setIsError(false); }, 500);
        }
      }
    }
  };

  if (!isLocked) return null;

  const { isBioEnabled } = getLockSettings();

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col select-none overflow-hidden"
      style={{ background: '#080808', color: 'white', fontFamily: 'inherit' }}
    >
      {/* ── 메인 콘텐츠 ─────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-between py-16 px-8 w-full max-w-sm mx-auto">

        {/* ── 상단: 아이콘 + 타이틀 + 도트 ───────────────── */}
        <div className="flex flex-col items-center gap-10 w-full">

          {/* 자물쇠 아이콘 */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
            className="flex flex-col items-center gap-5"
          >
            <div
              className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center"
              style={{
                background: isError ? 'rgba(255,32,58,0.1)' : 'rgba(255,255,255,0.06)',
                border: isError
                  ? '1px solid rgba(255,32,58,0.25)'
                  : '1px solid rgba(255,255,255,0.1)',
                transition: 'all 0.25s ease',
              }}
            >
              <ShieldAlert
                size={32}
                strokeWidth={1.5}
                style={{
                  color: isError ? '#FF203A' : 'rgba(255,255,255,0.6)',
                  transition: 'color 0.25s ease',
                }}
              />
            </div>

            {/* 타이틀 */}
            <div className="text-center">
              <h2
                className="text-[22px] font-bold tracking-tight mb-1.5"
                style={{ letterSpacing: '-0.03em' }}
              >
                {isError ? '암호가 틀렸습니다' : 'Grayn 잠금화면'}
              </h2>
              <p
                className="text-[13px] transition-colors duration-300"
                style={{
                  color: isError ? '#FF203A' : 'rgba(255,255,255,0.3)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {isError
                  ? `${failCount}회 오류 · 10회 초과 시 계정 차단`
                  : `비밀번호를 입력해주세요 (${failCount}/10)`}
              </p>
            </div>
          </motion.div>

          {/* PIN 도트 */}
          <motion.div
            animate={isError ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
            transition={{ duration: 0.45, ease: 'easeOut' }}
            className="flex items-center gap-5"
          >
            {[...Array(4)].map((_, i) => {
              const filled = i < pin.length;
              return (
                <motion.div
                  key={i}
                  animate={{
                    scale: filled ? 1 : 0.85,
                    backgroundColor: filled
                      ? isError ? '#FF203A' : '#FFFFFF'
                      : 'rgba(255,255,255,0.15)',
                  }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                  }}
                />
              );
            })}
          </motion.div>
        </div>

        {/* ── 키패드 ─────────────────────────────────────── */}
        <div className="w-full">
          {/* 숫자 1~9 */}
          <div className="grid grid-cols-3 gap-y-3 mb-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
              <KeypadButton
                key={n}
                label={n}
                onClick={() => handlePress(n)}
                disabled={isError}
                noisy={noiseKeys.includes(n)}
              />
            ))}
          </div>

          {/* 마지막 줄: Face ID / 0 / 삭제 */}
          <div className="grid grid-cols-3 gap-y-3">
            {/* Face ID */}
            <div className="flex justify-center items-center">
              {isBioEnabled && !isError ? (
                <button
                  onClick={triggerBiometric}
                  className="w-[72px] h-[72px] flex flex-col items-center justify-center gap-1 rounded-full transition-all active:scale-90"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  <ScanFace size={22} strokeWidth={1.5} />
                  <span className="text-[9px] font-medium tracking-wide uppercase" style={{ letterSpacing: '0.06em' }}>
                    Face ID
                  </span>
                </button>
              ) : <div />}
            </div>

            {/* 0 */}
            <KeypadButton
              label={0}
              onClick={() => handlePress(0)}
              disabled={isError}
              noisy={noiseKeys.includes(0)}
            />

            {/* 삭제 */}
            <div className="flex justify-center items-center">
              <button
                onClick={() => setPin(prev => prev.slice(0, -1))}
                className="w-[72px] h-[72px] flex items-center justify-center rounded-full transition-all active:scale-90"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <Delete size={22} strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        {/* ── 하단 여백 확보 ─────────────────────────────── */}
        <div className="h-4" />
      </div>

      {/* ── 접속 차단 모달 ──────────────────────────────── */}
      <AnimatePresence>
        {showBlockedModal && (
          <div className="fixed inset-0 z-[10000] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0"
              style={{ background: 'rgba(0,0,0,0.85)' }}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative z-10 w-full max-w-sm mx-auto px-5 pb-safe-or-10 pt-6 rounded-t-[28px]"
              style={{ background: '#111111', borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              {/* 핸들 */}
              <div
                className="w-9 h-[3px] rounded-full mx-auto mb-7"
                style={{ background: 'rgba(255,255,255,0.12)' }}
              />

              {/* 경고 아이콘 */}
              <div
                className="w-14 h-14 rounded-[18px] flex items-center justify-center mx-auto mb-5"
                style={{
                  background: 'rgba(255,32,58,0.1)',
                  border: '1px solid rgba(255,32,58,0.2)',
                }}
              >
                <AlertTriangle size={26} style={{ color: '#FF203A' }} strokeWidth={1.5} />
              </div>

              {/* 텍스트 */}
              <h3
                className="text-[18px] font-bold text-center mb-2"
                style={{ letterSpacing: '-0.02em' }}
              >
                접속이 차단되었습니다
              </h3>
              <p
                className="text-[13px] text-center leading-relaxed mb-8"
                style={{ color: 'rgba(255,255,255,0.35)' }}
              >
                비밀번호 10회 오류가 발생했습니다.{'\n'}
                계정 보호를 위해 앱 접근이 제한됩니다.
              </p>

              {/* 문의 버튼 */}
              <a
                href="mailto:support@grayn.com"
                className="flex items-center justify-center gap-2.5 w-full py-3.5 rounded-2xl text-[14px] font-bold"
                style={{ background: '#FF203A', color: 'white' }}
              >
                <Mail size={16} />
                고객센터 문의하기
              </a>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── 키패드 버튼 컴포넌트 ────────────────────────────────
function KeypadButton({
  label, onClick, disabled, noisy,
}: {
  label: number;
  onClick: () => void;
  disabled: boolean;
  noisy: boolean;
}) {
  return (
    <div className="flex justify-center">
      <motion.button
        onClick={onClick}
        disabled={disabled}
        whileTap={{ scale: 0.88 }}
        transition={{ duration: 0.1 }}
        className="relative w-[72px] h-[72px] rounded-full flex items-center justify-center outline-none"
        style={{
          background: noisy ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.08)',
          fontSize: 26,
          fontWeight: 300,
          color: disabled ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.9)',
          transition: 'background 0.1s ease, color 0.2s ease',
          letterSpacing: '-0.01em',
        }}
      >
        {label}
      </motion.button>
    </div>
  );
}