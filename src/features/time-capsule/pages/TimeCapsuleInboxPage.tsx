import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Hourglass, Lock, User as UserIcon,
  Clock, Unlock, Send, Sparkles, ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';
import TimeCapsuleUnlockModal from './TimeCapsuleUnlockModal';

interface ReceivedCapsule {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  message: string;
  scheduled_at: string;
  created_at: string;
  is_opened: boolean;
}

// 발신자별 그룹
interface SenderGroup {
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  capsules: ReceivedCapsule[];
  totalCount: number;
  unreadUnlockedCount: number; // 해제됐는데 아직 안 읽은 수
  nextUnlock: string | null;   // 아직 잠긴 것 중 가장 빠른 해제일
}

// 내가 보낸 배너 (수신자별 그룹)
interface SentBannerItem {
  receiver_id: string;
  receiver_name: string;
  count: number;
  nextUnlock: string | null;
}

export default function TimeCapsuleInboxPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [groups, setGroups] = useState<SenderGroup[]>([]);
  const [sentBanner, setSentBanner] = useState<SentBannerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedCapsule, setSelectedCapsule] = useState<ReceivedCapsule | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [justUnlockedIds, setJustUnlockedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // 잠금 해제 순간 감지 → 토스트
  useEffect(() => {
    groups.forEach(g => {
      g.capsules.forEach(c => {
        const unlocked = new Date(c.scheduled_at) <= now;
        if (unlocked && !c.is_opened && !justUnlockedIds.has(c.id)) {
          setJustUnlockedIds(prev => new Set(prev).add(c.id));
          toast.custom(() => (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="flex items-center gap-3 bg-gradient-to-r from-red-900 to-red-800 border border-red-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl"
            >
              <span className="text-2xl">🎉</span>
              <div>
                <p className="font-bold text-sm">{g.sender_name}님의 타임캡슐이 열렸어요!</p>
                <p className="text-xs text-red-300">탭해서 확인하세요</p>
              </div>
            </motion.div>
          ), { duration: 4000, position: 'top-center' });
        }
      });
    });
  }, [now, groups, justUnlockedIds]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: received, error } = await supabase
        .from('time_capsules')
        .select('*')
        .eq('receiver_id', user.id)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      // 내가 보낸 캡슐 (배너용)
      const { data: sent } = await supabase
        .from('time_capsules')
        .select('id, receiver_id, scheduled_at, is_opened')
        .eq('sender_id', user.id)
        .order('scheduled_at', { ascending: true });

      if (received && received.length > 0) {
        const senderIds = [...new Set(received.map(c => c.sender_id))];
        const { data: usersData } = await supabase.from('users').select('id, name').in('id', senderIds);
        const { data: profilesData } = await supabase.from('user_profiles').select('user_id, avatar_url').in('user_id', senderIds);

        const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

        const formatted: ReceivedCapsule[] = received.map(c => ({
          id: c.id,
          sender_id: c.sender_id,
          sender_name: usersMap.get(c.sender_id)?.name || '알 수 없는 사용자',
          sender_avatar: profilesMap.get(c.sender_id)?.avatar_url || null,
          message: c.message,
          scheduled_at: c.scheduled_at,
          created_at: c.created_at,
          is_opened: c.is_opened,
        }));

        // 발신자별 그룹핑
        const groupMap = new Map<string, SenderGroup>();
        formatted.forEach(c => {
          const isUnlockedNow = new Date(c.scheduled_at) <= new Date();
          const existing = groupMap.get(c.sender_id);
          if (!existing) {
            groupMap.set(c.sender_id, {
              sender_id: c.sender_id,
              sender_name: c.sender_name,
              sender_avatar: c.sender_avatar,
              capsules: [c],
              totalCount: 1,
              unreadUnlockedCount: isUnlockedNow && !c.is_opened ? 1 : 0,
              nextUnlock: !isUnlockedNow ? c.scheduled_at : null,
            });
          } else {
            existing.capsules.push(c);
            existing.totalCount++;
            if (isUnlockedNow && !c.is_opened) existing.unreadUnlockedCount++;
            if (!isUnlockedNow) {
              if (!existing.nextUnlock || c.scheduled_at < existing.nextUnlock) {
                existing.nextUnlock = c.scheduled_at;
              }
            }
          }
        });

        const groupArr = Array.from(groupMap.values());
        // 미확인 해제 있는 그룹 먼저
        groupArr.sort((a, b) => b.unreadUnlockedCount - a.unreadUnlockedCount);
        setGroups(groupArr);

        // 단일 캡슐 그룹은 기본 펼침
        const defaultExpanded = new Set<string>();
        groupArr.forEach(g => {
          if (g.totalCount === 1) defaultExpanded.add(g.sender_id);
        });
        setExpandedGroups(defaultExpanded);
      }

      // 보낸 배너 그룹핑
      if (sent && sent.length > 0) {
        const receiverIds = [...new Set(sent.map(s => s.receiver_id))];
        const { data: receiverUsers } = await supabase.from('users').select('id, name').in('id', receiverIds);
        const receiverMap = new Map(receiverUsers?.map(u => [u.id, u]) || []);

        const bannerMap = new Map<string, SentBannerItem>();
        sent.forEach(s => {
          const isUnlockedNow = new Date(s.scheduled_at) <= new Date();
          const existing = bannerMap.get(s.receiver_id);
          if (!existing) {
            bannerMap.set(s.receiver_id, {
              receiver_id: s.receiver_id,
              receiver_name: receiverMap.get(s.receiver_id)?.name || '친구',
              count: 1,
              nextUnlock: !isUnlockedNow ? s.scheduled_at : null,
            });
          } else {
            existing.count++;
            if (!isUnlockedNow) {
              if (!existing.nextUnlock || s.scheduled_at < existing.nextUnlock) {
                existing.nextUnlock = s.scheduled_at;
              }
            }
          }
        });
        setSentBanner(Array.from(bannerMap.values()));
      }
    } catch (err) {
      console.error('캡슐 로드 실패:', err);
      toast.error('목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // 실시간 구독
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('tc_inbox_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'time_capsules',
        filter: `receiver_id=eq.${user.id}`,
      }, () => {
        fetchData();
        toast.custom(() => (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 bg-gradient-to-r from-red-900 to-red-800 border border-red-500/40 text-white px-4 py-3 rounded-2xl shadow-2xl"
          >
            <span className="text-2xl">📮</span>
            <div>
              <p className="font-bold text-sm">새 타임캡슐이 도착했어요!</p>
              <p className="text-xs text-red-300">지정된 시간에 열 수 있어요</p>
            </div>
          </motion.div>
        ), { duration: 5000, position: 'top-center' });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, fetchData]);

  const getTimeRemaining = (unlockAt: string) => {
    const diff = new Date(unlockAt).getTime() - now.getTime();
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    if (days > 0) return `${days}일 ${hours}시간`;
    if (hours > 0) return `${hours}시간 ${minutes}분`;
    return `${minutes}분 ${seconds}초`;
  };

  const isUnlocked = (unlockAt: string) => new Date(unlockAt) <= now;

  const toggleGroup = (senderId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(senderId)) next.delete(senderId);
      else next.add(senderId);
      return next;
    });
  };

  const handleOpenCapsule = async (capsule: ReceivedCapsule) => {
    if (!isUnlocked(capsule.scheduled_at)) {
      toast.error('아직 열 수 없어요! ⏰');
      return;
    }
    if (!capsule.is_opened) {
      await supabase
        .from('time_capsules')
        .update({ is_opened: true, opened_at: new Date().toISOString() })
        .eq('id', capsule.id);
      setGroups(prev => prev.map(g => ({
        ...g,
        capsules: g.capsules.map(c =>
          c.id === capsule.id ? { ...c, is_opened: true } : c
        ),
        unreadUnlockedCount: g.sender_id === capsule.sender_id
          ? Math.max(0, g.unreadUnlockedCount - 1)
          : g.unreadUnlockedCount,
      })));
    }
    setSelectedCapsule(capsule);
    setIsModalOpen(true);
  };

  const getGroupStatus = (g: SenderGroup) => {
    if (g.unreadUnlockedCount > 0)
      return { text: `${g.unreadUnlockedCount}개 열 수 있어요!`, color: 'text-red-400', dot: 'bg-red-500', pulse: true };
    if (g.nextUnlock) {
      const r = getTimeRemaining(g.nextUnlock);
      return { text: r ? `${r} 후 해제` : '곧 열려요', color: 'text-[#8E8E93]', dot: 'bg-[#636366]', pulse: false };
    }
    return { text: '모두 확인함', color: 'text-[#636366]', dot: 'bg-[#444446]', pulse: false };
  };

  const totalUnread = groups.reduce((s, g) => s + g.unreadUnlockedCount, 0);

  return (
    <div className="h-[100dvh] bg-[#0D0D0F] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between bg-[#0D0D0F] border-b border-white/5 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold">받은 타임캡슐</h1>
          {totalUnread > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
            >
              <span className="text-[10px] font-bold">{totalUnread}</span>
            </motion.div>
          )}
        </div>
        <button onClick={() => navigate('/time-capsule/create')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <Send className="w-5 h-5 text-red-400" />
        </button>
      </header>

      {/* 내가 보낸 캡슐 배너 (수신자별 그룹) */}
      <AnimatePresence>
        {sentBanner.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="mx-4 mt-3 bg-gradient-to-r from-red-950/50 to-[#1A1A1C] border border-red-500/15 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-red-400" />
                <p className="text-xs text-red-400 font-semibold">
                  내가 보낸 타임캡슐 · 총 {sentBanner.reduce((s, b) => s + b.count, 0)}개
                </p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {sentBanner.map(sb => {
                  const remaining = sb.nextUnlock ? getTimeRemaining(sb.nextUnlock) : null;
                  return (
                    <button
                      key={sb.receiver_id}
                      onClick={() => navigate('/time-capsule/sent')}
                      className="shrink-0 bg-[#2C2C2E] rounded-xl px-3 py-2 border border-white/5 text-left min-w-[120px]"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-white text-xs font-semibold truncate max-w-[70px]">{sb.receiver_name}님</p>
                        {sb.count > 1 && (
                          <span className="bg-[#3A3A3C] text-[#8E8E93] text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                            {sb.count}개
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[#8E8E93] tabular-nums">
                        {remaining ? `${remaining} 후 해제` : '모두 해제됨'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="w-8 h-8 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#8E8E93]">
            <Hourglass className="w-14 h-14 opacity-10 mb-4" />
            <p className="text-sm font-medium">받은 타임캡슐이 없어요</p>
            <p className="text-xs mt-1 opacity-50">친구에게 먼저 타임캡슐을 보내보세요</p>
          </div>
        ) : (
          groups.map((group, gi) => {
            const isExpanded = expandedGroups.has(group.sender_id);
            const status = getGroupStatus(group);
            const isMultiple = group.totalCount > 1;

            return (
              <motion.div
                key={group.sender_id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.07 }}
                className={`rounded-2xl border overflow-hidden transition-all ${
                  group.unreadUnlockedCount > 0
                    ? 'border-red-500/30 bg-gradient-to-b from-red-950/30 to-[#141416] shadow-[0_0_20px_rgba(239,68,68,0.08)]'
                    : 'border-white/5 bg-[#141416]'
                }`}
              >
                {/* 그룹 헤더 */}
                <button
                  onClick={() => isMultiple && toggleGroup(group.sender_id)}
                  className={`w-full p-4 flex items-center gap-3 text-left ${isMultiple ? 'active:bg-white/5' : ''} transition-colors`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[#2C2C2E] overflow-hidden border border-white/10">
                      {group.sender_avatar ? (
                        <img src={group.sender_avatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-[#8E8E93] opacity-40" />
                        </div>
                      )}
                    </div>
                    {isMultiple && (
                      <div className={`absolute -top-1 -right-1 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#141416] ${
                        group.unreadUnlockedCount > 0 ? 'bg-red-500' : 'bg-[#3A3A3C]'
                      }`}>
                        {group.totalCount}
                      </div>
                    )}
                    {/* 해제 가능 표시 (단일) */}
                    {!isMultiple && group.unreadUnlockedCount > 0 && (
                      <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#141416] animate-pulse" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{group.sender_name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${status.dot} ${status.pulse ? 'animate-pulse' : ''}`} />
                      <p className={`text-xs truncate ${status.color}`}>{status.text}</p>
                    </div>
                  </div>

                  {isMultiple && (
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronDown className="w-4 h-4 text-[#636366] shrink-0" />
                    </motion.div>
                  )}
                </button>

                {/* 캡슐 개별 목록 */}
                <AnimatePresence initial={false}>
                  {(!isMultiple || isExpanded) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/5 divide-y divide-white/[0.04]">
                        {group.capsules.map((capsule, ci) => {
                          const unlocked = isUnlocked(capsule.scheduled_at);
                          const remaining = getTimeRemaining(capsule.scheduled_at);
                          const isNew = unlocked && !capsule.is_opened;

                          return (
                            <motion.button
                              key={capsule.id}
                              onClick={() => handleOpenCapsule(capsule)}
                              whileTap={unlocked ? { scale: 0.98 } : {}}
                              className={`w-full px-4 py-3.5 text-left transition-colors ${
                                isNew ? 'hover:bg-red-500/5 active:bg-red-500/10' : 'active:bg-white/3'
                              }`}
                            >
                              {/* 순번 + 날짜 */}
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                  <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
                                    isNew ? 'bg-red-500' : 'bg-[#2C2C2E]'
                                  }`}>
                                    <span className="text-[9px] font-bold text-white">{ci + 1}</span>
                                  </div>
                                  <span className="text-[11px] text-[#636366]">
                                    {new Date(capsule.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 보냄
                                  </span>
                                </div>
                                {isNew && (
                                  <motion.span
                                    animate={{ opacity: [0.7, 1, 0.7] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                    className="text-[10px] text-red-400 font-semibold"
                                  >
                                    탭해서 열기 ✨
                                  </motion.span>
                                )}
                              </div>

                              {/* 상태 뱃지 */}
                              {isNew ? (
                                <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-3 text-center">
                                  <p className="text-sm font-semibold text-red-300">🎉 지금 열 수 있어요!</p>
                                </div>
                              ) : unlocked && capsule.is_opened ? (
                                <div className="bg-[#1A1A1C] rounded-xl p-3 text-center">
                                  <p className="text-xs text-[#636366]">이미 확인한 타임캡슐</p>
                                </div>
                              ) : (
                                <div className="bg-[#0D0D0F] rounded-xl p-3 border border-white/5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 text-[#8E8E93]">
                                      <Clock className="w-3.5 h-3.5" />
                                      <span className="text-xs font-medium tabular-nums">{remaining}</span>
                                    </div>
                                    <Lock className="w-3.5 h-3.5 text-[#444446]" />
                                  </div>
                                  <p className="text-[10px] text-[#444446] mt-1.5">
                                    {new Date(capsule.scheduled_at).toLocaleDateString('ko-KR', {
                                      month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })} 해제
                                  </p>
                                </div>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 언락 모달 */}
      {selectedCapsule && (
        <TimeCapsuleUnlockModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedCapsule(null);
          }}
          capsule={selectedCapsule}
        />
      )}
    </div>
  );
}