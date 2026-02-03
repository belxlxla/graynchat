import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, User as UserIcon, Heart, AlertCircle } from 'lucide-react';
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

        if (new Date(data.unlock_at) > new Date()) {
          toast.error('아직 열 수 없습니다!');
          navigate(-1);
          return;
        }

        const { data: senderData } = await supabase
          .from('users')
          .select('id, name, avatar')
          .eq('id', data.sender_id)
          .single();

        // 처음 열었을 때만 unlocked_at 업데이트
        if (!data.is_unlocked) {
          const now = new Date();
          await supabase
            .from('time_capsules')
            .update({ 
              is_unlocked: true, 
              unlocked_at: now.toISOString() 
            })
            .eq('id', id);

          // 1일 후 삭제 예정 날짜 계산
          const deletionDate = new Date(now);
          deletionDate.setDate(deletionDate.getDate() + 1);
          setDeleteDate(deletionDate.toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }));
        } else if (data.unlocked_at) {
          // 이미 열렸던 경우 기존 unlocked_at 기준으로 계산
          const unlockedDate = new Date(data.unlocked_at);
          const deletionDate = new Date(unlockedDate);
          deletionDate.setDate(deletionDate.getDate() + 1);
          setDeleteDate(deletionDate.toLocaleString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }));
        }

        setCapsule({
          ...data,
          sender_name: senderData?.name || '알 수 없는 사용자',
          sender_avatar: senderData?.avatar || null
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

  if (isLoading) {
    return (
      <div className="h-[100dvh] bg-[#1C1C1E] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!capsule) return null;

  return (
    <div className="h-[100dvh] bg-gradient-to-b from-[#1C1C1E] to-[#000000] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between bg-transparent shrink-0">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-bold">타임캡슐</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-md"
        >
          {/* 보낸 사람 정보 */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full bg-[#3A3A3C] mx-auto mb-4 overflow-hidden border-4 border-orange-500/30">
              {capsule.sender_avatar ? (
                <img src={capsule.sender_avatar} className="w-full h-full object-cover" alt="" />
              ) : (
                <UserIcon className="w-10 h-10 m-auto mt-5 text-[#8E8E93] opacity-50" />
              )}
            </div>
            <p className="text-sm text-[#8E8E93] mb-1">From</p>
            <h2 className="text-2xl font-bold text-white">{capsule.sender_name}</h2>
            <p className="text-xs text-[#8E8E93] mt-2">
              {new Date(capsule.created_at).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}에 보냄
            </p>
          </div>

          {/* 메시지 */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="bg-[#2C2C2E] rounded-3xl p-6 border border-orange-500/30 shadow-[0_0_40px_rgba(234,88,12,0.15)]"
          >
            <p className="text-white text-base leading-relaxed whitespace-pre-wrap">
              {capsule.message}
            </p>
          </motion.div>

          {/* 잠금 해제 시간 */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="mt-6 text-center"
          >
            <p className="text-xs text-[#8E8E93] mb-2">잠금 해제</p>
            <p className="text-sm text-orange-400 font-medium">
              {new Date(capsule.unlock_at).toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </motion.div>

          {/* 삭제 안내 */}
          {deleteDate && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="mt-6 bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-400 mb-1">자동 삭제 안내</p>
                  <p className="text-xs text-orange-300/80 leading-relaxed">
                    이 타임캡슐은 <strong>{deleteDate}</strong>에 자동으로 삭제됩니다.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* 하트 아이콘 */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
            className="mt-8 flex justify-center"
          >
            <Heart className="w-8 h-8 text-orange-500 fill-orange-500" />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}