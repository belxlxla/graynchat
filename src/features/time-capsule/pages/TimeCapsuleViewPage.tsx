import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, User as UserIcon, Heart, AlertCircle, Copy, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

export default function TimeCapsuleViewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();

  const [capsule, setCapsule] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDate, setDeleteDate] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLong, setIsLong] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hearted, setHearted] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const fetchCapsule = async () => {
      if (!user?.id || !id) return;

      try {
        const { data, error } = await supabase
          .from('time_capsules')
          .select('*')
          .eq('id', id)
          .eq('receiver_id', user.id)
          .single();

        if (error) throw error;

        if (new Date(data.scheduled_at) > new Date()) {
          toast.error('아직 열 수 없습니다!');
          navigate(-1);
          return;
        }

        const { data: senderData } = await supabase.from('users').select('id, name').eq('id', data.sender_id).single();
        const { data: senderProfile } = await supabase.from('user_profiles').select('avatar_url').eq('user_id', data.sender_id).maybeSingle();

        if (!data.is_opened) {
          const now = new Date();
          await supabase.from('time_capsules').update({ is_opened: true, opened_at: now.toISOString() }).eq('id', id);

          const deletionDate = new Date(now);
          deletionDate.setDate(deletionDate.getDate() + 1);
          setDeleteDate(deletionDate.toLocaleString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }));
        } else if (data.opened_at) {
          const unlockedDate = new Date(data.opened_at);
          const deletionDate = new Date(unlockedDate);
          deletionDate.setDate(deletionDate.getDate() + 1);
          setDeleteDate(deletionDate.toLocaleString('ko-KR', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }));
        }

        setCapsule({
          ...data,
          sender_name: senderData?.name || '알 수 없는 사용자',
          sender_avatar: senderProfile?.avatar_url || null,
        });
      } catch (error) {
        console.error('캡슐 로드 실패:', error);
        toast.error('타임캡슐을 불러올 수 없습니다.');
        navigate(-1);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCapsule();
  }, [user, id, navigate]);

  useEffect(() => {
    if (capsule && messageRef.current) {
      setIsLong(messageRef.current.scrollHeight > 240);
    }
  }, [capsule]);

  const handleCopy = () => {
    if (!capsule) return;
    navigator.clipboard.writeText(capsule.message);
    setCopied(true);
    toast.success('메시지 복사됨!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="h-[100dvh] bg-[#0D0D0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!capsule) return null;

  return (
    <div className="h-[100dvh] bg-[#0D0D0F] text-white flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* 배경 별빛 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.4, 0] }}
            transition={{
              duration: 2 + Math.random() * 3,
              delay: Math.random() * 4,
              repeat: Infinity,
              repeatDelay: Math.random() * 5,
            }}
            className="absolute w-1 h-1 bg-white rounded-full"
            style={{
              top: `${Math.random() * 50}%`,
              left: `${Math.random() * 100}%`,
            }}
          />
        ))}
        {/* 하단 그라데이션 글로우 */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-red-950/20 to-transparent" />
      </div>

      {/* 헤더 */}
      <header className="relative h-14 px-4 flex items-center justify-between shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-red-400" />
          <h1 className="text-base font-bold">타임캡슐</h1>
        </div>
        <div className="w-10" />
      </header>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto relative z-10">
        <div className="flex flex-col items-center px-5 py-4 min-h-full">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            {/* 보낸 사람 */}
            <div className="text-center mb-6">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 180, damping: 14 }}
                className="relative w-20 h-20 mx-auto mb-4"
              >
                <div className="absolute inset-0 rounded-full bg-red-500/20 blur-xl animate-pulse" />
                <div className="relative w-20 h-20 rounded-full bg-[#2C2C2E] overflow-hidden border-2 border-red-500/40">
                  {capsule.sender_avatar ? (
                    <img src={capsule.sender_avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <UserIcon className="w-10 h-10 text-[#8E8E93] opacity-50" />
                    </div>
                  )}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <p className="text-xs text-[#8E8E93] mb-1 tracking-widest uppercase">From</p>
                <h2 className="text-2xl font-bold text-white">{capsule.sender_name}</h2>
                <p className="text-xs text-[#636366] mt-1.5">
                  {new Date(capsule.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}에 보낸 편지
                </p>
              </motion.div>
            </div>

            {/* 메시지 카드 */}
            <motion.div
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="relative"
            >
              {/* 카드 글로우 */}
              <div className="absolute -inset-1 bg-gradient-to-b from-red-500/10 to-transparent rounded-3xl blur-xl" />

              <div className="relative bg-[#141416] rounded-3xl border border-red-500/20 overflow-hidden shadow-[0_0_40px_rgba(239,68,68,0.1)]">
                {/* 카드 상단 장식 */}
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-red-500/60 to-transparent" />

                <div className="p-5">
                  {/* 메시지 */}
                  <div className="relative">
                    <p
                      ref={messageRef}
                      className={`text-white/90 text-base leading-[1.8] whitespace-pre-wrap transition-all duration-500 ${
                        !isExpanded && isLong ? 'max-h-[240px] overflow-hidden' : ''
                      }`}
                      style={{
                        maskImage: !isExpanded && isLong
                          ? 'linear-gradient(to bottom, black 55%, transparent 100%)'
                          : 'none',
                        WebkitMaskImage: !isExpanded && isLong
                          ? 'linear-gradient(to bottom, black 55%, transparent 100%)'
                          : 'none',
                      }}
                    >
                      {capsule.message}
                    </p>

                    {/* 더보기 / 접기 */}
                    {isLong && (
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-full flex items-center justify-center gap-2 pt-3 text-red-400 text-sm font-semibold"
                      >
                        {isExpanded ? (
                          <><ChevronUp className="w-4 h-4" /> 접기</>
                        ) : (
                          <><ChevronDown className="w-4 h-4" /> 전체 메시지 보기</>
                        )}
                      </motion.button>
                    )}
                  </div>

                  {/* 구분선 */}
                  <div className="my-4 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />

                  {/* 액션 바 */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-[#636366] mb-0.5">잠금 해제</p>
                      <p className="text-xs text-red-400 font-medium">
                        {new Date(capsule.scheduled_at).toLocaleDateString('ko-KR', {
                          month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2C2C2E] rounded-xl text-xs text-white/60 hover:text-white transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        {copied ? '복사됨!' : '복사'}
                      </button>
                      <motion.button
                        whileTap={{ scale: 0.75 }}
                        onClick={() => setHearted(!hearted)}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                          hearted ? 'bg-red-500/20 border border-red-500/40' : 'bg-[#2C2C2E]'
                        }`}
                      >
                        <Heart className={`w-4 h-4 transition-colors ${hearted ? 'text-red-500 fill-red-500' : 'text-[#8E8E93]'}`} />
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 자동 삭제 안내 */}
            {deleteDate && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                className="mt-4 bg-[#141416] border border-white/5 rounded-2xl p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-4 h-4 text-[#636366] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-[#8E8E93] mb-0.5">자동 삭제</p>
                    <p className="text-xs text-[#636366] leading-relaxed">
                      <span className="text-[#8E8E93]">{deleteDate}</span>에 자동으로 삭제됩니다.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 하트 */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.9, type: 'spring', stiffness: 200 }}
              className="mt-8 flex justify-center pb-8"
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Heart className="w-8 h-8 text-red-500 fill-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}