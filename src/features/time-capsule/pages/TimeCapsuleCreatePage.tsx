import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, User as UserIcon, Send, 
  X, Hourglass, AlertCircle, Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

interface Friend {
  id: number;
  friend_user_id: string;
  name: string;
  avatar: string | null;
}

type Step = 'select-friend' | 'write-message' | 'set-time' | 'confirm';

export default function TimeCapsuleCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('select-friend');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [displayedFriends, setDisplayedFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [message, setMessage] = useState('');
  const [unlockDate, setUnlockDate] = useState('');
  const [unlockTime, setUnlockTime] = useState('12:00');
  const [isSending, setIsSending] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const LOAD_COUNT = 20;

  // 친구 목록 불러오기
  useEffect(() => {
    const fetchFriends = async () => {
      if (!user?.id) return;

      try {
        const { data: friendsData } = await supabase
          .from('friends')
          .select('id, friend_user_id, name, avatar')
          .eq('user_id', user.id)
          .or('is_blocked.eq.false,is_blocked.is.null')
          .order('name', { ascending: true });

        if (friendsData && friendsData.length > 0) {
          const friendUUIDs = friendsData.map(f => f.friend_user_id).filter(Boolean);

        const { data: usersData } = await supabase
          .from('users')
          .select('id, name')
          .in('id', friendUUIDs);

        const { data: profilesData } = await supabase
          .from('user_profiles')
          .select('user_id, avatar_url')
          .in('user_id', friendUUIDs);

        const usersMap = new Map(usersData?.map(u => [u.id, u]) || []);
        const profilesMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);

        const mergedFriends = friendsData.map(friend => {
          const userInfo = usersMap.get(friend.friend_user_id);
          const profileInfo = profilesMap.get(friend.friend_user_id);
          return {
            id: friend.id,
            friend_user_id: friend.friend_user_id,
            name: userInfo?.name || friend.name,
            avatar: profileInfo?.avatar_url || friend.avatar
          };
        });

          setFriends(mergedFriends);
          setDisplayedFriends(mergedFriends.slice(0, LOAD_COUNT));
          setHasMore(mergedFriends.length > LOAD_COUNT);
        }
      } catch (error) {
        console.error('친구 목록 로드 실패:', error);
        toast.error('친구 목록을 불러올 수 없습니다.');
      }
    };

    fetchFriends();
  }, [user]);

  // 검색 필터링
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const query = searchQuery.toLowerCase();
    return friends.filter(f => f.name.toLowerCase().includes(query));
  }, [friends, searchQuery]);

  // 검색 시 표시 친구 업데이트
  useEffect(() => {
    if (searchQuery.trim()) {
      setDisplayedFriends(filteredFriends.slice(0, LOAD_COUNT));
      setHasMore(filteredFriends.length > LOAD_COUNT);
    } else {
      setDisplayedFriends(friends.slice(0, LOAD_COUNT));
      setHasMore(friends.length > LOAD_COUNT);
    }
  }, [searchQuery, filteredFriends, friends]);

  // 무한 스크롤
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    setTimeout(() => {
      const currentList = searchQuery.trim() ? filteredFriends : friends;
      const currentLength = displayedFriends.length;
      const nextBatch = currentList.slice(currentLength, currentLength + LOAD_COUNT);
      
      setDisplayedFriends(prev => [...prev, ...nextBatch]);
      setHasMore(currentLength + nextBatch.length < currentList.length);
      setIsLoadingMore(false);
    }, 300);
  }, [displayedFriends, friends, filteredFriends, searchQuery, isLoadingMore, hasMore]);

  // 스크롤 이벤트
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const bottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    
    if (bottom && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [hasMore, isLoadingMore, loadMore]);

  // 최소 날짜 계산 (오늘 + 1일)
  const minDate = useMemo(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }, []);

  // 타임캡슐 전송
  const handleSend = async () => {
    if (!user?.id || !selectedFriend || !message.trim() || !unlockDate || !unlockTime) {
      toast.error('모든 항목을 입력해주세요.');
      return;
    }

    setIsSending(true);

    try {
      const unlockDateTime = new Date(`${unlockDate}T${unlockTime}:00`);

      if (unlockDateTime <= new Date()) {
        toast.error('잠금 해제 시간은 현재보다 미래여야 합니다.');
        setIsSending(false);
        return;
      }

      const { error } = await supabase
        .from('time_capsules')
        .insert([{
          sender_id: user.id,
          receiver_id: selectedFriend.friend_user_id,
          message: message.trim(),
          unlock_at: unlockDateTime.toISOString()
        }]);

      if (error) throw error;

      toast.success('타임캡슐이 성공적으로 전송되었습니다! ⏰', {
        duration: 3000,
        style: { background: '#333', color: '#fff' }
      });

      navigate('/time-capsule/sent');
    } catch (error: any) {
      console.error('타임캡슐 전송 실패:', error);
      toast.error('전송에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSending(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 'select-friend':
        return (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* 검색바 */}
            <div className="px-4 py-3 bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
              <div className="bg-[#2C2C2E] rounded-xl flex items-center px-3 py-2.5">
                <Search className="w-4 h-4 text-[#8E8E93] mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="친구 이름 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-white placeholder-[#636366] text-sm w-full focus:outline-none"
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="ml-2">
                    <X className="w-4 h-4 text-[#8E8E93]" />
                  </button>
                )}
              </div>
            </div>

            {/* 친구 목록 */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar"
              onScroll={handleScroll}
            >
              {displayedFriends.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[#8E8E93]">
                  <UserIcon className="w-12 h-12 opacity-20 mb-3" />
                  <p className="text-sm">
                    {searchQuery ? '검색 결과가 없습니다.' : '친구를 먼저 추가해주세요.'}
                  </p>
                </div>
              ) : (
                <>
                  {displayedFriends.map(friend => (
                    <motion.button
                      key={friend.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setSelectedFriend(friend);
                        setStep('write-message');
                      }}
                      className="w-full flex items-center gap-3 p-4 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] active:scale-[0.98] transition-all"
                    >
                      <div className="w-12 h-12 rounded-full bg-[#3A3A3C] overflow-hidden border border-white/5">
                        {friend.avatar ? (
                          <img src={friend.avatar} className="w-full h-full object-cover" alt="" />
                        ) : (
                          <UserIcon className="w-6 h-6 m-auto mt-3 text-[#8E8E93] opacity-50" />
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-white font-medium">{friend.name}</p>
                      </div>
                      <div className="w-6 h-6 rounded-full border-2 border-red-500 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      </div>
                    </motion.button>
                  ))}
                  
                  {isLoadingMore && (
                    <div className="flex justify-center py-4">
                      <div className="w-6 h-6 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );

      case 'write-message':
        return (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <div className="mb-6 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-red-600/20 mx-auto mb-4 overflow-hidden border-2 border-red-500/30 flex items-center justify-center">
                {selectedFriend?.avatar ? (
                  <img src={selectedFriend.avatar} className="w-full h-full object-cover" alt="" />
                ) : (
                  <UserIcon className="w-10 h-10 text-red-500" />
                )}
              </div>
              <h3 className="text-xl font-bold text-white">{selectedFriend?.name}님에게</h3>
              <p className="text-sm text-[#8E8E93] mt-2">미래에 전달될 메시지를 작성하세요</p>
            </div>

            <div className="flex-1 mb-4">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="소중한 메시지를 입력하세요..."
                className="w-full h-full min-h-[200px] bg-[#2C2C2E] rounded-2xl p-4 text-white placeholder-[#636366] resize-none focus:outline-none focus:ring-2 focus:ring-red-500"
                maxLength={1000}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#8E8E93] mb-4">
              <span>최대 1000자</span>
              <span className={message.length > 900 ? 'text-red-500' : ''}>{message.length} / 1000</span>
            </div>

            <button
              onClick={() => setStep('set-time')}
              disabled={message.trim().length === 0}
              className="w-full py-4 bg-red-500 text-white font-bold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-600 transition-colors active:scale-[0.98]"
            >
              다음 단계
            </button>
          </div>
        );

      case 'set-time':
        return (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <div className="mb-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 mx-auto mb-4 flex items-center justify-center">
                <Hourglass className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white">언제 열릴까요?</h3>
              <p className="text-sm text-[#8E8E93] mt-2">지정한 시간까지 절대 열리지 않습니다</p>
            </div>

            <div className="space-y-6 mb-6">
              <div>
                <label className="block text-sm font-semibold text-white mb-3">날짜 선택</label>
                <input
                  type="date"
                  value={unlockDate}
                  onChange={(e) => setUnlockDate(e.target.value)}
                  min={minDate}
                  className="w-full bg-[#2C2C2E] text-white p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 border border-[#3A3A3C]"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-white mb-3">시간 선택</label>
                <input
                  type="time"
                  value={unlockTime}
                  onChange={(e) => setUnlockTime(e.target.value)}
                  className="w-full bg-[#2C2C2E] text-white p-4 rounded-2xl focus:outline-none focus:ring-2 focus:ring-red-500 border border-[#3A3A3C]"
                />
              </div>
            </div>

            {unlockDate && (
              <div className="mb-6 p-4 bg-gradient-to-r from-red-500/10 to-red-600/10 border border-red-500/30 rounded-2xl">
                <p className="text-sm text-center">
                  <span className="text-[#8E8E93]">잠금 해제: </span>
                  <span className="text-red-400 font-bold">
                    {new Date(`${unlockDate}T${unlockTime}`).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </p>
              </div>
            )}

            <button
              onClick={() => setStep('confirm')}
              disabled={!unlockDate}
              className="mt-auto w-full py-4 bg-red-500 text-white font-bold rounded-2xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-red-600 transition-colors active:scale-[0.98]"
            >
              확인
            </button>
          </div>
        );

      case 'confirm':
        return (
          <div className="flex-1 flex flex-col p-6 overflow-y-auto">
            <div className="mb-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 mx-auto mb-4 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">마지막 확인</h3>
              <p className="text-sm text-[#8E8E93] leading-relaxed">
                전송 후 1회만 수정할 수 있습니다.<br/>
                그 이후엔 발신자도 내용을 볼 수 없습니다.
              </p>
            </div>

            <div className="flex-1 bg-[#2C2C2E] rounded-2xl p-5 space-y-5 mb-6 border border-[#3A3A3C]">
              <div>
                <p className="text-xs text-[#8E8E93] mb-2 font-medium">받는 사람</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#3A3A3C] overflow-hidden">
                    {selectedFriend?.avatar ? (
                      <img src={selectedFriend.avatar} className="w-full h-full object-cover" alt="" />
                    ) : (
                      <UserIcon className="w-5 h-5 m-auto mt-2.5 text-[#8E8E93] opacity-50" />
                    )}
                  </div>
                  <p className="text-white font-semibold">{selectedFriend?.name}</p>
                </div>
              </div>

              <div className="h-[1px] bg-[#3A3A3C]" />

              <div>
                <p className="text-xs text-[#8E8E93] mb-2 font-medium">메시지</p>
                <div className="bg-[#1C1C1E] rounded-xl p-3 max-h-32 overflow-y-auto custom-scrollbar">
                  <p className="text-white text-sm leading-relaxed">{message}</p>
                </div>
              </div>

              <div className="h-[1px] bg-[#3A3A3C]" />

              <div>
                <p className="text-xs text-[#8E8E93] mb-2 font-medium">잠금 해제</p>
                <p className="text-red-400 font-semibold">
                  {new Date(`${unlockDate}T${unlockTime}`).toLocaleString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={isSending}
              className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-2xl disabled:opacity-50 hover:from-red-600 hover:to-red-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-500/20 active:scale-[0.98]"
            >
              {isSending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  전송 중...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  타임캡슐 전송
                </>
              )}
            </button>
          </div>
        );
    }
  };

  const stepLabels = ['친구 선택', '메시지 작성', '시간 설정', '전송 확인'];
  const stepOrder: Step[] = ['select-friend', 'write-message', 'set-time', 'confirm'];
  const currentStepIndex = stepOrder.indexOf(step);

  return (
    <div className="h-[100dvh] bg-[#1C1C1E] text-white flex flex-col">
      {/* 헤더 */}
      <header className="h-14 px-4 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
        <button 
          onClick={() => {
            if (step === 'select-friend') {
              navigate(-1);
            } else {
              const prevStepIndex = currentStepIndex - 1;
              if (prevStepIndex >= 0) {
                setStep(stepOrder[prevStepIndex]);
              }
            }
          }} 
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-base font-bold">타임캡슐 보내기</h1>
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 hover:bg-white/5 rounded-lg transition-colors"
        >
          <X className="w-6 h-6 text-[#8E8E93]" />
        </button>
      </header>

      {/* 진행 표시 - 세련된 디자인 */}
      <div className="px-6 py-5 bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0">
        <div className="relative">
          {/* 배경 라인 */}
          <div className="absolute top-3 left-0 right-0 h-[2px] bg-[#3A3A3C]" />
          
          {/* 진행 라인 */}
          <div 
            className="absolute top-3 left-0 h-[2px] bg-gradient-to-r from-red-500 to-red-600 transition-all duration-300 ease-out"
            style={{ width: `${(currentStepIndex / (stepOrder.length - 1)) * 100}%` }}
          />
          
          {/* 스텝 노드들 */}
          <div className="relative flex justify-between">
            {stepLabels.map((label, idx) => {
              const isCompleted = idx < currentStepIndex;
              const isCurrent = idx === currentStepIndex;
              const isActive = idx <= currentStepIndex;

              return (
                <div key={idx} className="flex flex-col items-center" style={{ width: '25%' }}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-2 transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' 
                      : isCurrent 
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/50 ring-4 ring-red-500/20' 
                      : 'bg-[#3A3A3C] text-[#8E8E93]'
                  }`}>
                    {isCompleted ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <span className={`text-[10px] font-medium text-center transition-colors duration-300 ${
                    isActive ? 'text-white' : 'text-[#8E8E93]'
                  }`}>
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col overflow-hidden"
        >
          {renderStepContent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}