import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Hourglass, Edit2, User as UserIcon, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

interface TimeCapsule {
  id: string;
  receiver_id: string;
  receiver_name: string;
  receiver_avatar: string | null;
  message: string;
  scheduled_at: string;
  created_at: string;
  is_edited: boolean;
  is_opened: boolean;
}

export default function TimeCapsuleSentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [capsules, setCapsules] = useState<TimeCapsule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSentCapsules = async () => {
      if (!user?.id) return;

      try {
        const { data, error } = await supabase
          .from('time_capsules')
          .select('*')
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const receiverIds = data.map(c => c.receiver_id);

          const { data: usersData } = await supabase
            .from('users')
            .select('id, name')
            .in('id', receiverIds);

          const { data: profilesData } = await supabase
            .from('user_profiles')
            .select('user_id, avatar_url')
            .in('user_id', receiverIds);

          const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
          const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

          const formatted = data.map(capsule => {
              const receiver = usersMap.get(capsule.receiver_id);
              const profile = profilesMap.get(capsule.receiver_id);
            return {
              id: capsule.id,
              receiver_id: capsule.receiver_id,
              receiver_name: receiver?.name || '알 수 없는 사용자',
              receiver_avatar: profile?.avatar_url || null, 
              message: capsule.message,
              scheduled_at: capsule.scheduled_at,
              created_at: capsule.created_at,
              is_edited: capsule.is_edited,
              is_opened: capsule.is_opened
            };
          });

          setCapsules(formatted);
        }
      } catch (error) {
        console.error('전송한 캡슐 로드 실패:', error);
        toast.error('목록을 불러올 수 없습니다.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSentCapsules();
  }, [user]);

  const getTimeRemaining = (unlockAt: string) => {
    const now = new Date();
    const unlock = new Date(unlockAt);
    const diff = unlock.getTime() - now.getTime();

    if (diff <= 0) return '잠금 해제됨';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days}일 ${hours}시간 남음`;
    return `${hours}시간 남음`;
  };

  return (
    <div className="h-[100dvh] bg-[#1C1C1E] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
        <button onClick={() => navigate(-1)} className="p-2">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-bold">보낸 타임캡슐</h1>
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
            <p className="text-sm">보낸 타임캡슐이 없습니다.</p>
          </div>
        ) : (
          capsules.map(capsule => (
            <motion.div
              key={capsule.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#2C2C2E] rounded-2xl p-4 border border-[#3A3A3C]"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">
                  {capsule.receiver_avatar ? (
                    <img src={capsule.receiver_avatar} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <UserIcon className="w-5 h-5 m-auto mt-2.5 text-[#8E8E93] opacity-50" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium text-sm">{capsule.receiver_name}</p>
                  <p className="text-xs text-[#8E8E93]">
                    {new Date(capsule.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                {!capsule.is_edited && !capsule.is_opened && new Date(capsule.scheduled_at) > new Date() && (
                  <button
                    onClick={() => navigate(`/time-capsule/edit/${capsule.id}`)}
                    className="p-2 bg-[#3A3A3C] rounded-lg hover:bg-[#48484A] transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-red-500" />
                  </button>
                )}
              </div>

              <div className="bg-[#1C1C1E] rounded-xl p-3 mb-3">
                <p className="text-sm text-white line-clamp-2">{capsule.message}</p>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-red-400">
                  <Clock className="w-3 h-3" />
                  <span>{getTimeRemaining(capsule.scheduled_at)}</span>
                </div>
                {capsule.is_edited && (
                  <span className="text-[#8E8E93]">수정됨</span>
                )}
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}