import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Lock, Unlock, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

const CATEGORIES = ['일상', '게임', '음악', '스터디', '운동', '여행', '맛집', '기타'];
const COLORS = ['#FF203A', '#FF6B35', '#845EF7', '#339AF0', '#20C997', '#F59F00', '#E64980', '#74C0FC'];
const MAX_OPTIONS = [10, 20, 30, 50, 100];

export default function CreateGatheringRoomPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('일상');
  const [isLocked, setIsLocked] = useState(false);
  const [password, setPassword] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [thumbnailColor, setThumbnailColor] = useState('#FF203A');
  const [isLoading, setIsLoading] = useState(false);

  const isValid = title.trim().length > 0 && (!isLocked || password.trim().length >= 4);

  const handleCreate = async () => {
    if (!user) return toast.error('로그인이 필요합니다.');
    if (!title.trim()) return toast.error('채팅방 이름을 입력해주세요.');
    if (isLocked && password.trim().length < 4) return toast.error('비밀번호는 4자 이상 입력해주세요.');
    setIsLoading(true);
    try {
      const { data: roomData, error: roomError } = await supabase
        .from('gathering_rooms').insert({
          host_id: user.id,
          title: title.trim(),
          description: description.trim(),
          category,
          is_locked: isLocked,
          password: isLocked ? password.trim() : null,
          max_participants: maxParticipants,
          thumbnail_color: thumbnailColor,
        }).select().single();
      if (roomError) throw roomError;
      await supabase.from('gathering_room_members').insert({ room_id: roomData.id, user_id: user.id });
      toast.success('채팅방이 개설되었습니다');
      navigate(`/gathering/chat/${roomData.id}`, { replace: true });
    } catch (err: any) {
      toast.error(err.message || '채팅방 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    color: 'rgba(255,255,255,0.82)',
  };

  return (
    <div className="flex flex-col h-[100dvh] text-white" style={{ background: '#080808' }}>
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 h-14 shrink-0"
        style={{ background: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}
          className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ color: 'rgba(255,255,255,0.45)' }}>
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <h1 className="flex-1 text-[15px]"
          style={{ color: 'rgba(255,255,255,0.82)', fontWeight: 500, letterSpacing: '-0.015em' }}>
          채팅방 개설
        </h1>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleCreate}
          disabled={isLoading || !isValid}
          className="px-4 py-1.5 rounded-xl text-[13px] transition-all"
          style={{
            background: isValid ? '#FF203A' : 'rgba(255,255,255,0.06)',
            color: isValid ? 'white' : 'rgba(255,255,255,0.25)',
            fontWeight: 500,
            opacity: isLoading ? 0.6 : 1,
          }}
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '개설'}
        </motion.button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-7">
        {/* 프리뷰 + 색상 */}
        <div className="flex flex-col items-center gap-4">
          <motion.div
            key={title.charAt(0) + thumbnailColor}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 0.25 }}
            className="w-[72px] h-[72px] rounded-[22px] flex items-center justify-center text-[26px] select-none"
            style={{
              background: `${thumbnailColor}18`,
              color: thumbnailColor,
              fontWeight: 600,
              border: `1px solid ${thumbnailColor}28`,
            }}
          >
            {title.charAt(0) || '?'}
          </motion.div>
          <div className="flex gap-2.5">
            {COLORS.map((c) => (
              <motion.button
                key={c}
                whileTap={{ scale: 0.85 }}
                onClick={() => setThumbnailColor(c)}
                className="w-6 h-6 rounded-full transition-all"
                style={{
                  background: c,
                  outline: thumbnailColor === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                  opacity: thumbnailColor === c ? 1 : 0.45,
                  transform: thumbnailColor === c ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>
        </div>

        {/* 채팅방 이름 */}
        <div>
          <p className="text-[11px] mb-2.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.28)' }}>채팅방 이름</p>
          <input
            value={title} onChange={(e) => setTitle(e.target.value)} maxLength={30}
            placeholder="어떤 주제로 모일까요?"
            className="w-full rounded-2xl px-4 py-3.5 text-[14px] focus:outline-none transition-all placeholder-white/20"
            style={{ ...fieldStyle, letterSpacing: '-0.01em' }}
          />
          <div className="flex justify-end mt-1.5">
            <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.18)' }}>{title.length}/30</span>
          </div>
        </div>

        {/* 소개 */}
        <div>
          <p className="text-[11px] mb-2.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.28)' }}>
            소개 <span style={{ color: 'rgba(255,255,255,0.18)' }}>선택</span>
          </p>
          <textarea
            value={description} onChange={(e) => setDescription(e.target.value)}
            maxLength={100} placeholder="채팅방을 간단히 소개해주세요" rows={3}
            className="w-full rounded-2xl px-4 py-3.5 text-sm focus:outline-none transition-all resize-none placeholder-white/20 leading-relaxed"
            style={fieldStyle}
          />
        </div>

        {/* 카테고리 */}
        <div>
          <p className="text-[11px] mb-2.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.28)' }}>카테고리</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <motion.button key={cat} whileTap={{ scale: 0.93 }} onClick={() => setCategory(cat)}
                className="px-3.5 py-2 rounded-xl text-[13px] transition-all"
                style={category === cat
                  ? { background: 'rgba(255,32,58,0.12)', color: '#FF203A', border: '1px solid rgba(255,32,58,0.25)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }
                }>
                {cat}
              </motion.button>
            ))}
          </div>
        </div>

        {/* 최대 인원 */}
        <div>
          <p className="text-[11px] mb-2.5 tracking-wide" style={{ color: 'rgba(255,255,255,0.28)' }}>최대 인원</p>
          <div className="flex gap-2">
            {MAX_OPTIONS.map((n) => (
              <motion.button key={n} whileTap={{ scale: 0.93 }} onClick={() => setMaxParticipants(n)}
                className="flex-1 py-2.5 rounded-xl text-[13px] transition-all"
                style={maxParticipants === n
                  ? { background: 'rgba(255,32,58,0.12)', color: '#FF203A', border: '1px solid rgba(255,32,58,0.25)' }
                  : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.35)', border: '1px solid rgba(255,255,255,0.07)' }
                }>
                {n}
              </motion.button>
            ))}
          </div>
        </div>

        {/* 비밀번호 */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          <motion.button whileTap={{ scale: 0.99 }} onClick={() => setIsLocked(!isLocked)}
            className="w-full flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
                style={{ background: isLocked ? 'rgba(255,32,58,0.12)' : 'rgba(255,255,255,0.05)' }}>
                {isLocked
                  ? <Lock className="w-4 h-4" style={{ color: '#FF203A' }} />
                  : <Unlock className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
                }
              </div>
              <div className="text-left">
                <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.72)', fontWeight: 450 }}>비밀번호 설정</p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {isLocked ? '입장 시 비밀번호 필요' : '누구나 입장 가능'}
                </p>
              </div>
            </div>
            <div className="w-11 h-6 rounded-full flex items-center px-0.5 transition-all"
              style={{ background: isLocked ? '#FF203A' : 'rgba(255,255,255,0.1)' }}>
              <motion.div
                animate={{ x: isLocked ? 20 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-5 h-5 rounded-full bg-white shadow"
              />
            </div>
          </motion.button>

          <AnimatePresence>
            {isLocked && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <input
                    type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호 입력 (4자 이상)" maxLength={20}
                    className="w-full rounded-xl px-4 py-3.5 text-sm focus:outline-none mt-4 transition-all placeholder-white/20 text-center tracking-wider"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.82)' }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
}