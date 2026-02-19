import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Hourglass, Lock, User as UserIcon, Clock, Unlock } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

interface ReceivedCapsule {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  message: string;
  unlock_at: string;
  created_at: string;
  is_unlocked: boolean;
}

export default function TimeCapsuleInboxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [capsules, setCapsules] = useState<ReceivedCapsule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchReceivedCapsules = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('time_capsules')
          .select('*')
          .eq('receiver_id', user.id)
          .order('unlock_at', { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          const senderIds = data.map(c => c.sender_id);

        const { data: usersData } = await supabase
          .from('users')
          .select('id, name')
          .in('id', senderIds);

        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('user_id, avatar_url')
          .in('user_id', senderIds);

        const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

          const formatted = data.map(capsule => {
          const sender = usersMap.get(capsule.sender_id);
          const profile = profilesMap.get(capsule.sender_id);
            return {
              id: capsule.id,
              sender_id: capsule.sender_id,
              sender_name: sender?.name || '알 수 없는 사용자',
              sender_avatar: profile?.avatar_url || null,
              message: capsule.message,
              unlock_at: capsule.unlock_at,
              created_at: capsule.created_at,
              is_unlocked: capsule.is_unlocked
            };
          });

          setCapsules(formatted);
        }
      } catch (error) {
        console.error('받은 캡슐 로드 실패:', error);
        toast.error('목록을 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchReceivedCapsules();
  }, [user]);

  const getTimeRemaining = (unlockAt: string) => {
    const now = new Date();
    const unlock = new Date(unlockAt);
    const diff = unlock.getTime() - now.getTime();

    if (diff <= 0) return null;

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days}일 ${hours}시간`;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${minutes}분`;
  };

  const isUnlocked = (unlockAt: string) => {
    return new Date(unlockAt) <= new Date();
  };

  const handleOpenCapsule = async (capsule: ReceivedCapsule) => {
    if (!isUnlocked(capsule.unlock_at)) {
      toast.error('아직 열 수 없습니다! ⏰');
      return;
    }

    // 잠금 해제 상태 업데이트
    if (!capsule.is_unlocked) {
      await supabase
        .from('time_capsules')
        .update({ is_unlocked: true, unlocked_at: new Date().toISOString() })
        .eq('id', capsule.id);
    }

    navigate(`/time-capsule/view/${capsule.id}`);
  };

  return (
    <div className="h-[100dvh] bg-[#1C1C1E] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-bold">받은 타임캡슐</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : capsules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#8E8E93]">
            <Hourglass className="w-12 h-12 opacity-20 mb-3" />
            <p className="text-sm">받은 타임캡슐이 없습니다.</p>
          </div>
        ) : (
          capsules.map(capsule => {
            const unlocked = isUnlocked(capsule.unlock_at);
            const remaining = getTimeRemaining(capsule.unlock_at);

            return (
              <motion.button
                key={capsule.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleOpenCapsule(capsule)}
                className={`w-full bg-[#2C2C2E] rounded-2xl p-4 border transition-all ${
                  unlocked 
                    ? 'border-red-500/50 hover:border-red-500 hover:bg-[#3A3A3C]' 
                    : 'border-[#3A3A3C]'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">
                    {capsule.sender_avatar ? (
                      <img src={capsule.sender_avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <UserIcon className="w-5 h-5 m-auto mt-2.5 text-[#8E8E93] opacity-50" />
                    )}
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-white font-medium text-sm">{capsule.sender_name}</p>
                    <p className="text-xs text-[#8E8E93]">
                      {new Date(capsule.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  {unlocked ? (
                    <Unlock className="w-5 h-5 text-red-500" />
                  ) : (
                    <Lock className="w-5 h-5 text-[#8E8E93]" />
                  )}
                </div>

                {unlocked ? (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-center">
                    <p className="text-sm font-medium text-red-400">잠금 해제됨! 탭하여 확인</p>
                  </div>
                ) : (
                  <div className="bg-[#1C1C1E] rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-2 text-[#8E8E93]">
                      <Clock className="w-4 h-4" />
                      <p className="text-sm font-medium">{remaining} 남음</p>
                    </div>
                  </div>
                )}
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}