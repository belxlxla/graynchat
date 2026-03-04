import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Hourglass, Edit2, User as UserIcon,
  Clock, Send, Inbox, Sparkles, ChevronDown,
  CheckCircle2, Lock, Unlock
} from 'lucide-react';
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

interface ReceiverGroup {
  receiver_id: string;
  receiver_name: string;
  receiver_avatar: string | null;
  capsules: TimeCapsule[];
  totalCount: number;
  unreadCount: number;
  pendingCount: number;
  nextUnlock: string | null;
}

interface ReceivedBannerItem {
  sender_id: string;
  sender_name: string;
  count: number;
  nextUnlock: string;
}

export default function TimeCapsuleSentPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [groups, setGroups] = useState<ReceiverGroup[]>([]);
  const [receivedBanner, setReceivedBanner] = useState<ReceivedBannerItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data, error } = await supabase
        .from('time_capsules')
        .select('*')
        .eq('sender_id', user.id)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      const { data: received } = await supabase
        .from('time_capsules')
        .select('id, sender_id, scheduled_at, is_opened')
        .eq('receiver_id', user.id)
        .order('scheduled_at', { ascending: true });

      if (data && data.length > 0) {
        const receiverIds = [...new Set(data.map(c => c.receiver_id))];
        const { data: usersData } = await supabase.from('users').select('id, name').in('id', receiverIds);
        const { data: profilesData } = await supabase.from('user_profiles').select('user_id, avatar_url').in('user_id', receiverIds);

        const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

        const formatted: TimeCapsule[] = data.map(c => ({
          id: c.id,
          receiver_id: c.receiver_id,
          receiver_name: usersMap.get(c.receiver_id)?.name || '알 수 없는 사용자',
          receiver_avatar: profilesMap.get(c.receiver_id)?.avatar_url || null,
          message: c.message,
          scheduled_at: c.scheduled_at,
          created_at: c.created_at,
          is_edited: c.is_edited,
          is_opened: c.is_opened,
        }));

        // 수신자별 그룹핑
        const groupMap = new Map<string, ReceiverGroup>();
        formatted.forEach(c => {
          const isUnlockedNow = new Date(c.scheduled_at) <= new Date();
          const existing = groupMap.get(c.receiver_id);
          if (!existing) {
            groupMap.set(c.receiver_id, {
              receiver_id: c.receiver_id,
              receiver_name: c.receiver_name,
              receiver_avatar: c.receiver_avatar,
              capsules: [c],
              totalCount: 1,
              unreadCount: isUnlockedNow && !c.is_opened ? 1 : 0,
              pendingCount: !isUnlockedNow ? 1 : 0,
              nextUnlock: !isUnlockedNow ? c.scheduled_at : null,
            });
          } else {
            existing.capsules.push(c);
            existing.totalCount++;
            if (isUnlockedNow && !c.is_opened) existing.unreadCount++;
            if (!isUnlockedNow) {
              existing.pendingCount++;
              if (!existing.nextUnlock || c.scheduled_at < existing.nextUnlock) {
                existing.nextUnlock = c.scheduled_at;
              }
            }
          }
        });

        const groupArr = Array.from(groupMap.values());
        setGroups(groupArr);

        // 캡슐이 1개뿐인 그룹은 기본 펼침
        const defaultExpanded = new Set<string>();
        groupArr.forEach(g => {
          if (g.totalCount === 1) defaultExpanded.add(g.receiver_id);
        });
        setExpandedGroups(defaultExpanded);
      }

      if (received && received.length > 0) {
        const senderIds = [...new Set(received.map(r => r.sender_id))];
        const { data: senderUsers } = await supabase.from('users').select('id, name').in('id', senderIds);
        const senderMap = new Map(senderUsers?.map(u => [u.id, u]) || []);

        const bannerMap = new Map<string, ReceivedBannerItem>();
        received.forEach(r => {
          const existing = bannerMap.get(r.sender_id);
          if (!existing) {
            bannerMap.set(r.sender_id, {
              sender_id: r.sender_id,
              sender_name: senderMap.get(r.sender_id)?.name || '친구',
              count: 1,
              nextUnlock: r.scheduled_at,
            });
          } else {
            existing.count++;
            if (r.scheduled_at < existing.nextUnlock) existing.nextUnlock = r.scheduled_at;
          }
        });
        setReceivedBanner(Array.from(bannerMap.values()));
      }
    } catch (err) {
      console.error('로드 실패:', err);
      toast.error('목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

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

  const toggleGroup = (receiverId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(receiverId)) next.delete(receiverId);
      else next.add(receiverId);
      return next;
    });
  };

  const getGroupStatus = (g: ReceiverGroup) => {
    if (g.unreadCount > 0)
      return { text: `${g.unreadCount}개 해제됨 · 미확인`, color: 'text-yellow-400', dot: 'bg-yellow-400', pulse: true };
    if (g.pendingCount > 0 && g.nextUnlock) {
      const r = getTimeRemaining(g.nextUnlock);
      return { text: r ? `${r} 후 해제` : '곧 열려요', color: 'text-red-400', dot: 'bg-red-500', pulse: false };
    }
    return { text: '모두 확인됨', color: 'text-[#636366]', dot: 'bg-[#444446]', pulse: false };
  };

  return (
    <div className="h-[100dvh] bg-[#0D0D0F] text-white flex flex-col">
      <header className="h-14 px-4 flex items-center justify-between bg-[#0D0D0F] border-b border-white/5 shrink-0">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-bold">보낸 타임캡슐</h1>
        <div className="flex gap-1">
          <button onClick={() => navigate('/time-capsule/inbox')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <Inbox className="w-5 h-5 text-[#8E8E93]" />
          </button>
          <button onClick={() => navigate('/time-capsule/create')} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <Send className="w-5 h-5 text-red-400" />
          </button>
        </div>
      </header>

      {/* 쌍방 배너 */}
      <AnimatePresence>
        {receivedBanner.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden shrink-0"
          >
            <div className="mx-4 mt-3 bg-gradient-to-r from-[#1A1A1C] to-red-950/30 border border-red-500/15 rounded-2xl p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Sparkles className="w-3.5 h-3.5 text-red-400" />
                <p className="text-xs text-red-400 font-semibold">
                  나에게 온 타임캡슐 · 총 {receivedBanner.reduce((s, r) => s + r.count, 0)}개
                </p>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                {receivedBanner.map(rb => {
                  const remaining = getTimeRemaining(rb.nextUnlock);
                  return (
                    <button
                      key={rb.sender_id}
                      onClick={() => navigate('/time-capsule/inbox')}
                      className="shrink-0 bg-[#2C2C2E] rounded-xl px-3 py-2 border border-white/5 text-left min-w-[120px]"
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-white text-xs font-semibold truncate max-w-[70px]">{rb.sender_name}님</p>
                        {rb.count > 1 && (
                          <span className="bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0">
                            {rb.count}개
                          </span>
                        )}
                      </div>
                      <p className={`text-[10px] tabular-nums ${!remaining ? 'text-yellow-400 font-medium' : 'text-[#8E8E93]'}`}>
                        {remaining ? `${remaining} 후 해제` : '지금 열 수 있어요!'}
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
            <p className="text-sm font-medium">보낸 타임캡슐이 없어요</p>
            <button
              onClick={() => navigate('/time-capsule/create')}
              className="mt-4 px-5 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-2xl"
            >
              첫 타임캡슐 보내기
            </button>
          </div>
        ) : (
          groups.map((group, gi) => {
            const isExpanded = expandedGroups.has(group.receiver_id);
            const status = getGroupStatus(group);
            const isMultiple = group.totalCount > 1;

            return (
              <motion.div
                key={group.receiver_id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: gi * 0.07 }}
                className="rounded-2xl border border-white/5 bg-[#141416] overflow-hidden"
              >
                {/* 그룹 헤더 */}
                <button
                  onClick={() => isMultiple && toggleGroup(group.receiver_id)}
                  className={`w-full p-4 flex items-center gap-3 text-left ${isMultiple ? 'active:bg-white/5' : ''} transition-colors`}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[#2C2C2E] overflow-hidden border border-white/10">
                      {group.receiver_avatar ? (
                        <img src={group.receiver_avatar} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-[#8E8E93] opacity-40" />
                        </div>
                      )}
                    </div>
                    {isMultiple && (
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#141416]">
                        {group.totalCount}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm">{group.receiver_name}님</p>
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
                          const canEdit = !capsule.is_edited && !capsule.is_opened && !unlocked;

                          return (
                            <div key={capsule.id} className="px-4 py-3.5">
                              {/* 캡슐 번호 + 수정 버튼 */}
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-[#2C2C2E] flex items-center justify-center">
                                    <span className="text-[9px] text-[#8E8E93] font-bold">{ci + 1}</span>
                                  </div>
                                  <span className="text-[11px] text-[#636366]">
                                    {new Date(capsule.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 전송
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {capsule.is_edited && (
                                    <span className="text-[10px] bg-[#2C2C2E] text-[#636366] px-1.5 py-0.5 rounded-full">수정됨</span>
                                  )}
                                  {canEdit && (
                                    <button
                                      onClick={() => navigate(`/time-capsule/edit/${capsule.id}`)}
                                      className="p-1.5 bg-[#2C2C2E] rounded-lg hover:bg-[#3A3A3C] transition-colors"
                                    >
                                      <Edit2 className="w-3.5 h-3.5 text-red-400" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* 메시지 미리보기 */}
                              <div className={`rounded-xl p-3 mb-2.5 relative overflow-hidden ${
                                unlocked ? 'bg-[#1E1E20]' : 'bg-[#0D0D0F] border border-white/5'
                              }`}>
                                {unlocked ? (
                                  <p className="text-sm text-white/60 line-clamp-2 leading-relaxed">{capsule.message}</p>
                                ) : (
                                  <>
                                    <p className="text-sm text-white/15 line-clamp-2 blur-[5px] select-none leading-relaxed">
                                      {capsule.message}
                                    </p>
                                    <div className="absolute inset-0 flex items-center justify-center gap-1.5">
                                      <Lock className="w-3 h-3 text-[#636366]" />
                                      <span className="text-[10px] text-[#636366]">잠금 중</span>
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* 상태 */}
                              <div className="flex items-center justify-between">
                                {capsule.is_opened ? (
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#636366]" />
                                    <span className="text-xs text-[#636366]">상대방 확인 완료</span>
                                  </div>
                                ) : unlocked ? (
                                  <div className="flex items-center gap-1.5">
                                    <Unlock className="w-3.5 h-3.5 text-yellow-400" />
                                    <span className="text-xs text-yellow-400 font-medium">해제됨 · 미확인</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-red-400" />
                                    <span className="text-xs text-red-400 font-medium tabular-nums">
                                      {remaining} 후 해제
                                    </span>
                                  </div>
                                )}
                                <span className="text-[10px] text-[#444446]">
                                  {new Date(capsule.scheduled_at).toLocaleDateString('ko-KR', {
                                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* 추가 전송 버튼 */}
                      <div className="px-4 pb-3.5 pt-1">
                        <button
                          onClick={() => navigate('/time-capsule/create')}
                          className="w-full py-2 rounded-xl border border-dashed border-white/8 text-xs text-[#636366] hover:border-red-500/30 hover:text-red-400/60 transition-all flex items-center justify-center gap-1.5"
                        >
                          <Send className="w-3 h-3" />
                          {group.receiver_name}님에게 또 보내기
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}