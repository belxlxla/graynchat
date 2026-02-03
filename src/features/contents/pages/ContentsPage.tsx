import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, MessageSquare, Sparkles, 
  ChevronRight, Hourglass, Send, Clock, Archive, Lock, Unlock,
  Loader2,
  CalendarCheck, FileBarChart, ListTodo
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

// --- 타입 정의 ---
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

  // 결제 로딩 및 타겟 상태
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<'capsule' | 'report' | null>(null);
  
  // 타임캡슐 데이터 상태
  const [activeTab, setActiveTab] = useState<TabType>('sent');
  const [sentCapsules, setSentCapsules] = useState<TimeCapsule[]>([]);
  const [receivedCapsules, setReceivedCapsules] = useState<TimeCapsule[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // 1. 타임캡슐 데이터 로드
  useEffect(() => {
    if (!user?.id) {
      setIsDataLoading(false);
      return;
    }

    const fetchCapsules = async () => {
      try {
        // 보낸 캡슐 조회
        const { data: sentData } = await supabase
          .from('time_capsules')
          .select('*')
          .eq('sender_id', user.id)
          .order('created_at', { ascending: false });

        if (sentData) {
          const receiverIds = sentData.map(c => c.receiver_id);
          const { data: users } = await supabase.from('users').select('id, name').in('id', receiverIds);
          const userMap = new Map(users?.map(u => [u.id, u.name]) || []);
          
          setSentCapsules(sentData.map(c => ({
            ...c,
            receiver_name: userMap.get(c.receiver_id) || '알 수 없음'
          })));
        }

        // 받은 캡슐 조회
        const { data: receivedData } = await supabase
          .from('time_capsules')
          .select('*')
          .eq('receiver_id', user.id)
          .order('unlock_at', { ascending: true });

        if (receivedData) {
          const senderIds = receivedData.map(c => c.sender_id);
          const { data: users } = await supabase.from('users').select('id, name').in('id', senderIds);
          const userMap = new Map(users?.map(u => [u.id, u.name]) || []);

          setReceivedCapsules(receivedData.map(c => ({
            ...c,
            sender_name: userMap.get(c.sender_id) || '알 수 없음'
          })));
        }
      } catch (error) {
        console.error('Data load error:', error);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchCapsules();
  }, [user]);

  // --- 결제 및 페이지 이동 핸들러 ---
  const handlePaymentAndNavigate = async (type: 'capsule' | 'report') => {
    if (!user?.id) return;
    
    setIsPaymentLoading(true);
    setPaymentTarget(type);

    try {
      // 결제 시뮬레이션 (1.5초)
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (type === 'capsule') {
        // 4,900원 결제 성공 시 -> 생성 페이지로 이동
        toast.success('4,900원 결제 완료! 캡슐을 생성합니다.');
        navigate('/time-capsule/create');
      } else {
        // 2,900원 결제 성공 시 -> 리포트 페이지로 이동
        toast.success('2,900원 결제 완료! 리포트를 분석합니다.');
        navigate('/main/contents/report');
      }
    } catch (error) {
      toast.error('결제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsPaymentLoading(false);
      setPaymentTarget(null);
    }
  };

  // --- Helper Functions ---
  const getTimeRemaining = (unlockAt: string) => {
    const diff = new Date(unlockAt).getTime() - new Date().getTime();
    if (diff <= 0) return '잠금 해제됨';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return days > 0 ? `${days}일 ${hours}시간 남음` : `${hours}시간 남음`;
  };

  const canEdit = (c: TimeCapsule) => !c.is_edited && !c.is_unlocked && new Date(c.unlock_at) > new Date();
  const canView = (c: TimeCapsule) => new Date(c.unlock_at) <= new Date();

  return (
    <div className="h-full w-full flex flex-col bg-[#000000] text-white">
      {/* 헤더 */}
      <header className="h-14 px-5 flex items-center bg-[#000000] border-b border-[#1C1C1E] sticky top-0 z-10">
        <h1 className="text-xl font-bold tracking-tight">콘텐츠 스토어</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-10 pb-24">
        
        {/* === SECTION 1: 타임캡슐 (4,900원 / 건당) === */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-orange-500 rounded-full" />
            <h2 className="text-lg font-bold">타임캡슐</h2>
          </div>

          <div className="space-y-4">
            {/* 새 캡슐 보내기 버튼 (결제 트리거) */}
            <button
              onClick={() => handlePaymentAndNavigate('capsule')}
              disabled={isPaymentLoading}
              className="w-full bg-[#1C1C1E] border border-white/10 rounded-2xl p-5 flex items-center justify-between active:scale-[0.98] transition-transform relative overflow-hidden group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-[#2C2C2E] rounded-xl flex items-center justify-center text-orange-500 group-hover:text-white transition-colors">
                  <Send className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-white text-lg">새 캡슐 보내기</p>
                    <span className="text-[11px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                      ₩4,900
                    </span>
                  </div>
                  <p className="text-sm text-gray-400">친구에게 미래의 감동을 선물하세요</p>
                </div>
              </div>
              
              {isPaymentLoading && paymentTarget === 'capsule' ? (
                <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
              ) : (
                <ChevronRight className="w-6 h-6 text-gray-600 group-hover:text-white" />
              )}
            </button>

            {/* 탭 & 리스트 (기존 내역 확인용) */}
            <div className="bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E] overflow-hidden">
              <div className="flex border-b border-[#2C2C2E]">
                <button
                  onClick={() => setActiveTab('sent')}
                  className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'sent' ? 'text-white bg-[#252525]' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  보낸 캡슐 ({sentCapsules.length})
                </button>
                <div className="w-[1px] bg-[#2C2C2E]" />
                <button
                  onClick={() => setActiveTab('received')}
                  className={`flex-1 py-4 text-sm font-medium transition-colors ${activeTab === 'received' ? 'text-white bg-[#252525]' : 'text-gray-500 hover:text-gray-300'}`}
                >
                  받은 캡슐 ({receivedCapsules.length})
                </button>
              </div>

              <div className="p-3 min-h-[150px]">
                {isDataLoading ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-500 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                    <span className="text-xs">데이터 불러오는 중</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {(activeTab === 'sent' ? sentCapsules : receivedCapsules).length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Archive className="w-10 h-10 mx-auto mb-3 opacity-20" />
                        <p className="text-sm font-medium">
                          {activeTab === 'sent' ? '보낸 타임캡슐이 없습니다.' : '받은 타임캡슐이 없습니다.'}
                        </p>
                      </div>
                    ) : (
                      (activeTab === 'sent' ? sentCapsules : receivedCapsules).map(c => {
                        const locked = !canView(c);
                        const name = activeTab === 'sent' ? c.receiver_name : c.sender_name;
                        
                        return (
                          <div key={c.id} 
                            onClick={() => !locked && activeTab === 'received' && navigate(`/time-capsule/view/${c.id}`)}
                            className={`p-4 rounded-xl border flex items-center justify-between transition-colors ${
                              locked 
                                ? 'bg-[#151515] border-[#252525] text-gray-500' 
                                : 'bg-[#252525] border-orange-500/20 text-white cursor-pointer hover:bg-[#2a2a2a]'
                            }`}
                          >
                            <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${locked ? 'bg-[#2C2C2E]' : 'bg-orange-500/10'}`}>
                                {locked ? <Lock className="w-5 h-5 text-gray-600" /> : <Unlock className="w-5 h-5 text-orange-500" />}
                              </div>
                              <div>
                                <p className="text-base font-bold mb-0.5">{name}</p>
                                <p className="text-xs opacity-70 flex items-center gap-1.5">
                                  <Clock className="w-3 h-3" /> {getTimeRemaining(c.unlock_at)}
                                </p>
                              </div>
                            </div>
                            {activeTab === 'sent' && canEdit(c) && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); navigate(`/time-capsule/edit/${c.id}`); }}
                                className="text-xs font-bold text-white bg-[#3A3A3C] px-3 py-1.5 rounded-lg hover:bg-[#48484A] transition-colors"
                              >
                                수정
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <div className="h-[1px] bg-[#2C2C2E]" />

        {/* === SECTION 2: AI 연구소 (2,900원 / 건당) === */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 bg-purple-500 rounded-full" />
            <h2 className="text-lg font-bold">AI 연구소</h2>
          </div>

          {/* AI 리포트 버튼 (결제 트리거) */}
          <button
            onClick={() => handlePaymentAndNavigate('report')}
            disabled={isPaymentLoading}
            className="w-full bg-[#1C1C1E] border border-white/10 rounded-2xl p-5 flex items-center justify-between active:scale-[0.98] transition-transform relative overflow-hidden mb-6 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#2C2C2E] rounded-xl flex items-center justify-center text-purple-500 group-hover:text-white transition-colors">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-bold text-white text-lg">AI 친구 리포트</p>
                  <span className="text-[11px] font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                    ₩2,900
                  </span>
                </div>
                <p className="text-sm text-gray-400">관계 정밀 분석 및 맞춤형 솔루션</p>
              </div>
            </div>

            {isPaymentLoading && paymentTarget === 'report' ? (
              <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
            ) : (
              <ChevronRight className="w-6 h-6 text-gray-600 group-hover:text-white" />
            )}
          </button>

          {/* 준비중인 기능들 (Clean Grid) */}
          <div className="grid grid-cols-2 gap-4">
            <FeatureCard icon={<MessageSquare />} title="채팅 도우미" desc="답장 추천 AI" />
            <FeatureCard icon={<ListTodo />} title="대화 요약" desc="3줄 핵심 요약" />
            <FeatureCard icon={<CalendarCheck />} title="일정 비서" desc="약속 자동 추출" />
            <FeatureCard icon={<FileBarChart />} title="서류 생성" desc="견적서/영수증" />
          </div>
        </section>
      </div>
    </div>
  );
}

// 서브 컴포넌트: 준비중 카드 (Clean UI)
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl p-5 relative opacity-50 pointer-events-none">
      <div className="w-10 h-10 bg-[#252525] rounded-xl flex items-center justify-center text-gray-400 mb-3">
        {icon}
      </div>
      <h3 className="text-white font-bold text-base mb-1">{title}</h3>
      <p className="text-xs text-gray-500">{desc}</p>
      <div className="absolute top-4 right-4 px-2 py-1 bg-[#252525] rounded text-[10px] text-gray-500 border border-[#333] font-medium">
        준비중
      </div>
    </div>
  );
}