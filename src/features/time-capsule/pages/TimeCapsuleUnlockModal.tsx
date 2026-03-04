import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, Copy, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface UnlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  capsule: {
    id: string;
    sender_name: string;
    sender_avatar: string | null;
    message: string;
    created_at: string;
    scheduled_at: string;
  };
}

// 파티클 컴포넌트
function Particle({ delay, x, y, color }: { delay: number; x: number; y: number; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      animate={{
        opacity: 0,
        scale: Math.random() * 0.5 + 0.5,
        x: x * (Math.random() * 120 + 60),
        y: y * (Math.random() * 120 + 60),
        rotate: Math.random() * 360,
      }}
      transition={{ duration: 1.2 + Math.random() * 0.8, delay, ease: 'easeOut' }}
      className="absolute w-2 h-2 rounded-full pointer-events-none"
      style={{ backgroundColor: color, top: '50%', left: '50%' }}
    />
  );
}

const PARTICLE_COLORS = ['#EF4444', '#F97316', '#FBBF24', '#EC4899', '#8B5CF6', '#ffffff'];

export default function TimeCapsuleUnlockModal({ isOpen, onClose, capsule }: UnlockModalProps) {
  const [phase, setPhase] = useState<'sealed' | 'cracking' | 'opened'>('sealed');
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; color: string; delay: number }>>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const [isLong, setIsLong] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPhase('sealed');
      setIsExpanded(false);

      // 1초 후 크래킹 시작
      const t1 = setTimeout(() => {
        setPhase('cracking');

        // 파티클 생성
        const newParticles = Array.from({ length: 28 }, (_, i) => ({
          id: i,
          x: (Math.random() - 0.5) * 2,
          y: (Math.random() - 0.5) * 2,
          color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
          delay: i * 0.03,
        }));
        setParticles(newParticles);

        // 0.5초 후 오픈
        const t2 = setTimeout(() => setPhase('opened'), 500);
        return () => clearTimeout(t2);
      }, 900);
      return () => clearTimeout(t1);
    }
  }, [isOpen]);

  useEffect(() => {
    if (phase === 'opened' && messageRef.current) {
      setIsLong(messageRef.current.scrollHeight > 200);
    }
  }, [phase]);

  const handleCopy = () => {
    navigator.clipboard.writeText(capsule.message);
    setCopied(true);
    toast.success('메시지 복사됨!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* 오버레이 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={phase === 'opened' ? onClose : undefined}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md"
          />

          {/* 모달 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-5 pointer-events-none"
          >
            <div className="relative w-full max-w-sm pointer-events-auto">

              {/* 파티클 레이어 */}
              <div className="absolute inset-0 pointer-events-none overflow-visible">
                <AnimatePresence>
                  {phase === 'cracking' && particles.map(p => (
                    <Particle key={p.id} x={p.x} y={p.y} color={p.color} delay={p.delay} />
                  ))}
                </AnimatePresence>
              </div>

              {/* === SEALED 상태 === */}
              <AnimatePresence mode="wait">
                {phase === 'sealed' && (
                  <motion.div
                    key="sealed"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.2 }}
                    transition={{ duration: 0.4 }}
                    className="flex flex-col items-center justify-center py-16 px-8"
                  >
                    {/* 캡슐 아이콘 */}
                    <motion.div
                      animate={{
                        y: [0, -12, 0],
                        rotate: [0, -3, 3, 0],
                      }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      className="relative w-24 h-24 mb-6"
                    >
                      {/* 글로우 */}
                      <div className="absolute inset-0 rounded-full bg-red-500/30 blur-xl animate-pulse" />
                      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-red-400 via-red-500 to-red-700 flex items-center justify-center shadow-2xl shadow-red-500/50 border border-red-300/30">
                        <span className="text-4xl">⏳</span>
                      </div>
                    </motion.div>

                    <motion.p
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-white/70 text-sm font-medium tracking-widest uppercase"
                    >
                      타임캡슐 해제 중...
                    </motion.p>
                  </motion.div>
                )}

                {/* === CRACKING 상태 === */}
                {phase === 'cracking' && (
                  <motion.div
                    key="cracking"
                    initial={{ scale: 1 }}
                    animate={{ scale: [1, 1.15, 0.95, 1.1, 1] }}
                    transition={{ duration: 0.5 }}
                    className="flex justify-center py-16"
                  >
                    <div className="relative w-24 h-24">
                      <div className="absolute inset-0 rounded-full bg-red-500/60 blur-2xl" />
                      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-yellow-300 via-red-400 to-red-600 flex items-center justify-center">
                        <span className="text-4xl">💥</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* === OPENED 상태 === */}
                {phase === 'opened' && (
                  <motion.div
                    key="opened"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="relative"
                  >
                    {/* 닫기 버튼 */}
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      onClick={onClose}
                      className="absolute -top-2 -right-2 z-10 w-8 h-8 bg-[#3A3A3C] rounded-full flex items-center justify-center border border-white/10"
                    >
                      <X className="w-4 h-4 text-[#8E8E93]" />
                    </motion.button>

                    {/* 카드 */}
                    <div className="bg-[#1C1C1E] rounded-3xl overflow-hidden border border-red-500/20 shadow-[0_0_60px_rgba(239,68,68,0.2)]">

                      {/* 헤더 그라데이션 */}
                      <div className="relative h-28 bg-gradient-to-br from-red-950 via-red-900 to-[#1C1C1E] overflow-hidden">
                        {/* 별빛 효과 */}
                        {[...Array(12)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: [0, 1, 0.5], scale: 1 }}
                            transition={{ delay: 0.3 + i * 0.06, duration: 0.8 }}
                            className="absolute w-1 h-1 bg-white/60 rounded-full"
                            style={{
                              top: `${Math.random() * 80}%`,
                              left: `${Math.random() * 100}%`,
                            }}
                          />
                        ))}

                        {/* 타이틀 */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
                            className="flex items-center gap-1.5 mb-2"
                          >
                            <Sparkles className="w-4 h-4 text-red-400" />
                            <span className="text-xs text-red-400 font-bold tracking-widest uppercase">타임캡슐 도착</span>
                            <Sparkles className="w-4 h-4 text-red-400" />
                          </motion.div>
                          <motion.p
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.35 }}
                            className="text-white/90 text-sm"
                          >
                            <span className="font-bold text-red-300">{capsule.sender_name}</span>님이 보낸 편지
                          </motion.p>
                        </div>
                      </div>

                      {/* 보낸 사람 */}
                      <div className="px-5 pt-4 pb-3 flex items-center gap-3">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.4, type: 'spring', stiffness: 180 }}
                          className="w-10 h-10 rounded-full bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center text-white font-bold text-sm border-2 border-red-400/40 overflow-hidden shrink-0"
                        >
                          {capsule.sender_avatar ? (
                            <img src={capsule.sender_avatar} className="w-full h-full object-cover" alt="" />
                          ) : (
                            capsule.sender_name[0]
                          )}
                        </motion.div>
                        <div>
                          <p className="text-white font-semibold text-sm">{capsule.sender_name}</p>
                          <p className="text-[#8E8E93] text-xs">
                            {new Date(capsule.created_at).toLocaleDateString('ko-KR', {
                              year: 'numeric', month: 'long', day: 'numeric'
                            })}에 작성
                          </p>
                        </div>
                      </div>

                      {/* 구분선 */}
                      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />

                      {/* 메시지 */}
                      <div className="px-5 pt-4 pb-2">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5, duration: 0.6 }}
                        >
                          <div
                            ref={messageRef}
                            className={`text-white text-sm leading-relaxed whitespace-pre-wrap transition-all duration-500 ${
                              !isExpanded && isLong ? 'max-h-[200px] overflow-hidden' : ''
                            }`}
                            style={{
                              maskImage: !isExpanded && isLong
                                ? 'linear-gradient(to bottom, black 60%, transparent 100%)'
                                : 'none',
                              WebkitMaskImage: !isExpanded && isLong
                                ? 'linear-gradient(to bottom, black 60%, transparent 100%)'
                                : 'none',
                            }}
                          >
                            {capsule.message}
                          </div>

                          {/* 더보기 / 접기 */}
                          {isLong && (
                            <button
                              onClick={() => setIsExpanded(!isExpanded)}
                              className="w-full flex items-center justify-center gap-1.5 py-2 text-red-400 text-xs font-semibold mt-1"
                            >
                              {isExpanded ? (
                                <>접기 <ChevronUp className="w-3.5 h-3.5" /></>
                              ) : (
                                <>전체 보기 <ChevronDown className="w-3.5 h-3.5" /></>
                              )}
                            </button>
                          )}
                        </motion.div>
                      </div>

                      {/* 구분선 */}
                      <div className="mx-5 h-px bg-[#2C2C2E]" />

                      {/* 하단 액션 */}
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.7 }}
                        className="px-5 py-4 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          <span className="text-[#8E8E93] text-xs">
                            {new Date(capsule.scheduled_at).toLocaleDateString('ko-KR', {
                              month: 'long', day: 'numeric'
                            })} 해제
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* 복사 버튼 */}
                          <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2C2C2E] rounded-xl text-xs text-white/70 hover:text-white transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {copied ? '복사됨!' : '복사'}
                          </button>

                          {/* 하트 */}
                          <motion.button
                            whileTap={{ scale: 0.8 }}
                            className="w-8 h-8 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-center"
                          >
                            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                          </motion.button>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}