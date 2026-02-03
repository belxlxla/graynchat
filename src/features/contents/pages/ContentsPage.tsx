import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, MessageSquare, Sparkles, Calculator, 
  Heart, Briefcase, ChevronRight,
  Hourglass, Send, Clock, Archive, Lock, Unlock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

type TabType = 'sent' | 'received';

interface TimeCapsule {
  id: string;
  sender_id: string;
  receiver_id: string;
  receiver_name?: string;
  sender_name?: string;
  message: string;
  unlock_at: string;
  created_at: string;
  is_edited: boolean;
  is_unlocked: boolean;
}

export default function ContentsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [hasTimeCapsuleAccess, setHasTimeCapsuleAccess] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<TabType>('sent');
  const [sentCapsules, setSentCapsules] = useState<TimeCapsule[]>([]);
  const [receivedCapsules, setReceivedCapsules] = useState<TimeCapsule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 타임캡슐 결제 여부 확인
  useEffect(() => {
    const checkAccess = async () => {
      if (!user?.id) return;
      
      const savedAccess = localStorage.getItem(`timecapsule_access_${user.id}`);
      if (savedAccess === 'true') {
        setHasTimeCapsuleAccess(true);
      }
    };
    
    checkAccess();
  }, [user]);

  // 타임캡슐 목록 가져오기
  useEffect(() => {
    if (!user?.id || !hasTimeCapsuleAccess) {
      setIsLoading(false);
      return;
    }

    const fetchCapsules = async () => {
      try {
        // 보낸 타임캡슐
        const { data: sentData } = await supabase
          .from('time_capsules')
          .select('*')
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false });

        if (sentData && sentData.length > 0) {
          const receiverIds = sentData.map(c => c.receiver_id);
          const { data: usersData } = await supabase
            .from('users')
            .select('id, name')
            .in('id', receiverIds);

          const usersMap = new Map(usersData?.map(u => [u.id, u.name]) || []);
          
          setSentCapsules(sentData.map(c => ({
            ...c,
            receiver_name: usersMap.get(c.receiver_id) || '알 수 없는 사용자'
          })));
        }

        // 받은 타임캡슐
        const { data: receivedData } = await supabase
          .from('time_capsules')
          .select('*')
          .eq('receiver_id', user.id)
          .order('unlock_at', { ascending: true });

        if (receivedData && receivedData.length > 0) {
          const senderIds = receivedData.map(c => c.sender_id);
          const { data: usersData } = await supabase
            .from('users')
            .select('id, name')
            .in('id', senderIds);

          const usersMap = new Map(usersData?.map(u => [u.id, u.name]) || []);
          
          setReceivedCapsules(receivedData.map(c => ({
            ...c,
            sender_name: usersMap.get(c.sender_id) || '알 수 없는 사용자'
          })));
        }
      } catch (error) {
        console.error('타임캡슐 로드 실패:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCapsules();
  }, [user, hasTimeCapsuleAccess]);

  const handleTimeCapsulePayment = async () => {
    if (!user?.id) return;

    setIsPaymentLoading(true);

    try {
      const platform = Capacitor.getPlatform();
      
      await new Promise(resolve => setTimeout(resolve, 1500));

      localStorage.setItem(`timecapsule_access_${user.id}`, 'true');
      setHasTimeCapsuleAccess(true);

      toast.success('타임캡슐 기능이 활성화되었습니다! ⏰', {
        duration: 3000,
        style: { background: '#333', color: '#fff' }
      });

      navigate('/time-capsule/create');
    } catch (error) {
      console.error('결제 실패:', error);
      toast.error('결제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsPaymentLoading(false);
    }
  };

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

  const canEdit = (capsule: TimeCapsule) => {
    return !capsule.is_edited && 
           !capsule.is_unlocked && 
           new Date(capsule.unlock_at) > new Date();
  };

  const canView = (capsule: TimeCapsule) => {
    return new Date(capsule.unlock_at) <= new Date();
  };

  return (
    <div className="h-full w-full flex flex-col bg-[#0f0f10] text-white overflow-hidden relative">
      {/* Background Ambient Light */}
      <div className="absolute top-0 left-0 w-full h-[300px] bg-gradient-to-b from-[#2a2a2e] to-transparent opacity-30 pointer-events-none" />

      <header className="h-16 px-6 flex items-center justify-between bg-[#0f0f10]/80 backdrop-blur-xl border-b border-white/5 shrink-0 z-20 sticky top-0">
        <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
          콘텐츠
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 pb-10">
        
        {/* === 타임캡슐 섹션 === */}
        <section className="p-6 space-y-5">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-orange-500/10">
              <Hourglass className="w-5 h-5 text-orange-500" />
            </div>
            <h2 className="text-xl font-bold text-white">타임캡슐</h2>
          </div>

          {!hasTimeCapsuleAccess ? (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleTimeCapsulePayment}
              disabled={isPaymentLoading}
              className="w-full relative overflow-hidden group rounded-3xl"
            >
              {/* Premium Gradient Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600" />
              <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
              
              <div className="relative p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-inner border border-white/20">
                    <Sparkles className="w-7 h-7 text-white fill-white/30" />
                  </div>
                  <div className="text-left">
                    <p className="text-white font-bold text-lg leading-tight">타임캡슐 시작하기</p>
                    <p className="text-orange-100 text-sm mt-1 font-medium">미래에 열리는 특별한 메시지</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-white font-black text-xl tracking-tight">6,900원</span>
                  <div className="flex items-center text-white/80 text-xs font-medium bg-black/10 px-2 py-1 rounded-lg">
                    <span>구매하기</span>
                    <ChevronRight className="w-3 h-3 ml-0.5" />
                  </div>
                </div>
              </div>

              {isPaymentLoading && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                    <span className="text-white text-sm font-medium">결제 처리 중...</span>
                  </div>
                </div>
              )}
            </motion.button>
          ) : (
            <div className="space-y-6">
              {/* 타임캡슐 보내기 버튼 (활성화 상태) */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/time-capsule/create')}
                className="w-full bg-gradient-to-r from-[#2C2C2E] to-[#252529] rounded-3xl p-1 shadow-lg border border-white/5 group"
              >
                <div className="bg-[#1C1C1E] rounded-[20px] p-5 flex items-center justify-between h-full relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-32 h-32 bg-orange-500/10 blur-[50px] rounded-full pointer-events-none group-hover:bg-orange-500/20 transition-colors" />
                  
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-900/20">
                      <Send className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="text-white font-bold text-lg">새 캡슐 보내기</p>
                      <p className="text-gray-400 text-sm mt-0.5">친구에게 미래의 감동을 전하세요</p>
                    </div>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/10 transition-colors">
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </motion.button>

              {/* 탭 컨트롤 */}
              <div className="flex p-1 bg-[#1C1C1E] rounded-xl border border-white/5">
                <button
                  onClick={() => setActiveTab('sent')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all relative ${
                    activeTab === 'sent' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {activeTab === 'sent' && (
                    <motion.div
                      layoutId="tab-pill"
                      className="absolute inset-0 bg-[#2C2C2E] rounded-lg shadow-sm border border-white/5"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Send className="w-3.5 h-3.5" /> 보낸 캡슐 ({sentCapsules.length})
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('received')}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all relative ${
                    activeTab === 'received' ? 'text-white' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {activeTab === 'received' && (
                    <motion.div
                      layoutId="tab-pill"
                      className="absolute inset-0 bg-[#2C2C2E] rounded-lg shadow-sm border border-white/5"
                      initial={false}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <Archive className="w-3.5 h-3.5" /> 받은 캡슐 ({receivedCapsules.length})
                  </span>
                </button>
              </div>

              {/* 캡슐 리스트 */}
              <div className="min-h-[200px]">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                    <p className="text-sm text-gray-500">데이터를 불러오는 중...</p>
                  </div>
                ) : (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="space-y-3"
                    >
                      {activeTab === 'sent' ? (
                        sentCapsules.length === 0 ? (
                          <EmptyState 
                            icon={<Send className="w-8 h-8" />} 
                            title="보낸 캡슐이 없습니다"
                            desc="소중한 사람에게 마음을 전해보세요" 
                          />
                        ) : (
                          sentCapsules.map(capsule => (
                            <div key={capsule.id} className="bg-[#1C1C1E] border border-white/5 rounded-2xl p-5 relative overflow-hidden group">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-full bg-[#2C2C2E] flex items-center justify-center border border-white/5 text-orange-500 font-bold text-sm">
                                    TO
                                  </div>
                                  <div>
                                    <p className="text-white font-bold text-[15px]">{capsule.receiver_name}</p>
                                    <p className="text-xs text-gray-500">{new Date(capsule.created_at).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                {canEdit(capsule) && (
                                  <button
                                    onClick={() => navigate(`/time-capsule/edit/${capsule.id}`)}
                                    className="px-3 py-1.5 bg-[#2C2C2E] hover:bg-[#3A3A3C] border border-white/5 text-xs text-white font-medium rounded-lg transition-colors"
                                  >
                                    수정하기
                                  </button>
                                )}
                              </div>

                              <div className="bg-[#252529] rounded-xl p-3 mb-3 border border-white/5">
                                {capsule.is_edited ? (
                                  <p className="text-xs text-orange-400/80 italic text-center py-1">
                                    <span className="inline-block w-1.5 h-1.5 bg-orange-500 rounded-full mr-2"/>
                                    수정됨 (내용 비공개)
                                  </p>
                                ) : !capsule.is_unlocked && new Date(capsule.unlock_at) > new Date() ? (
                                  <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed px-1">"{capsule.message}"</p>
                                ) : (
                                  <p className="text-xs text-gray-500 italic text-center py-1">이미 개봉된 캡슐입니다</p>
                                )}
                              </div>

                              <div className="flex items-center justify-between pt-1">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-md">
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>{getTimeRemaining(capsule.unlock_at)}</span>
                                </div>
                                {capsule.is_edited && (
                                  <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-1 rounded">수정됨 1/1</span>
                                )}
                              </div>
                            </div>
                          ))
                        )
                      ) : (
                        receivedCapsules.length === 0 ? (
                          <EmptyState 
                            icon={<Archive className="w-8 h-8" />} 
                            title="받은 캡슐이 없습니다"
                            desc="친구가 보낸 캡슐이 여기에 표시됩니다" 
                          />
                        ) : (
                          receivedCapsules.map(capsule => {
                            const isLocked = !canView(capsule);
                            return (
                              <button
                                key={capsule.id}
                                onClick={() => {
                                  if (!isLocked) navigate(`/time-capsule/view/${capsule.id}`);
                                  else toast.error('아직 열 수 없습니다! 🔒');
                                }}
                                className={`w-full text-left rounded-2xl p-5 border relative overflow-hidden transition-all group ${
                                  isLocked 
                                    ? 'bg-[#1C1C1E] border-white/5 opacity-80' 
                                    : 'bg-[#1C1C1E] border-orange-500/30 hover:border-orange-500 hover:shadow-lg hover:shadow-orange-900/10'
                                }`}
                              >
                                {isLocked && (
                                  <div className="absolute -right-4 -top-4 w-16 h-16 bg-[#2C2C2E] rotate-45 flex items-end justify-center pb-1">
                                    <Lock className="w-4 h-4 text-gray-500 -rotate-45" />
                                  </div>
                                )}
                                
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border text-sm font-bold ${
                                      isLocked 
                                        ? 'bg-[#252529] border-white/5 text-gray-500' 
                                        : 'bg-orange-500/10 border-orange-500/20 text-orange-500'
                                    }`}>
                                      FR
                                    </div>
                                    <div>
                                      <p className={`font-bold text-[15px] ${isLocked ? 'text-gray-400' : 'text-white'}`}>
                                        {capsule.sender_name}
                                      </p>
                                      <p className="text-xs text-gray-600">
                                        {new Date(capsule.created_at).toLocaleDateString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {isLocked ? (
                                  <div className="bg-[#252529] rounded-xl p-4 flex flex-col items-center justify-center gap-2 border border-white/5">
                                    <Lock className="w-5 h-5 text-gray-600" />
                                    <p className="text-xs text-gray-500 font-medium">
                                      {getTimeRemaining(capsule.unlock_at)} 후 공개
                                    </p>
                                  </div>
                                ) : (
                                  <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/5 rounded-xl p-4 flex items-center justify-between border border-orange-500/20">
                                    <div className="flex items-center gap-2">
                                      <Unlock className="w-4 h-4 text-orange-500" />
                                      <span className="text-sm font-bold text-orange-400">잠금 해제됨</span>
                                    </div>
                                    <div className="text-xs text-orange-300 flex items-center font-medium group-hover:translate-x-1 transition-transform">
                                      확인하기 <ChevronRight className="w-3 h-3 ml-0.5" />
                                    </div>
                                  </div>
                                )}
                              </button>
                            );
                          })
                        )
                      )}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="w-full h-[1px] bg-[#2C2C2E] mx-auto my-2" />

        {/* === 기타 기능 섹션 === */}
        <section className="p-6 pt-2 space-y-4">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="p-2 rounded-xl bg-purple-500/10">
              <Sparkles className="w-5 h-5 text-purple-500" />
            </div>
            <h2 className="text-xl font-bold text-white">AI 연구소</h2>
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/main/contents/report')}
            className="w-full bg-[#1C1C1E] rounded-3xl p-5 border border-white/5 flex items-center justify-between group hover:bg-[#252529] transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center border border-purple-500/20">
                <FileText className="w-6 h-6 text-purple-400" />
              </div>
              <div className="text-left">
                <p className="text-white font-bold text-base group-hover:text-purple-300 transition-colors">AI 친구 리포트</p>
                <p className="text-gray-500 text-xs mt-0.5">관계 분석 및 맞춤형 조언</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
          </motion.button>

          {/* 비활성 카드 그리드 */}
          <div className="grid grid-cols-2 gap-3 opacity-60">
            <DisabledContentCard
              icon={<MessageSquare className="w-5 h-5" />}
              title="채팅 도우미"
              desc="답장 추천"
            />
            <DisabledContentCard
              icon={<Calculator className="w-5 h-5" />}
              title="매칭 점수"
              desc="궁합 분석"
            />
            <DisabledContentCard
              icon={<Heart className="w-5 h-5" />}
              title="감정 분석"
              desc="마음 읽기"
            />
            <DisabledContentCard
              icon={<Briefcase className="w-5 h-5" />}
              title="비즈니스"
              desc="네트워킹"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

// ---------------- Helper Components (Styled) ----------------

function EmptyState({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-[#1C1C1E] rounded-2xl border border-white/5 border-dashed">
      <div className="w-16 h-16 bg-[#252529] rounded-full flex items-center justify-center text-gray-600 mb-4">
        {icon}
      </div>
      <p className="text-white font-bold text-base mb-1">{title}</p>
      <p className="text-xs text-gray-500">{desc}</p>
    </div>
  );
}

function DisabledContentCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-[#1C1C1E] rounded-2xl p-4 border border-white/5 flex flex-col items-start gap-3 relative overflow-hidden">
      <div className="w-10 h-10 bg-[#252529] rounded-xl flex items-center justify-center text-gray-500">
        {icon}
      </div>
      <div>
        <p className="text-gray-300 font-bold text-sm">{title}</p>
        <p className="text-gray-600 text-[10px] mt-0.5">{desc}</p>
      </div>
      <span className="absolute top-3 right-3 text-[9px] bg-[#2C2C2E] text-gray-500 px-1.5 py-0.5 rounded border border-white/5">준비중</span>
    </div>
  );
}