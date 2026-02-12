import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Sparkles,
  ChevronRight,
  Send, Clock, Archive, Lock, Unlock,
  Loader2,
  CalendarCheck, FileBarChart, ListTodo,
  Star, ShieldCheck, Zap
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

  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<'capsule' | 'report' | null>(null);

  const [activeTab, setActiveTab] = useState<TabType>('sent');
  const [sentCapsules, setSentCapsules] = useState<TimeCapsule[]>([]);
  const [receivedCapsules, setReceivedCapsules] = useState<TimeCapsule[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // ── 타임캡슐 데이터 로드 ──────────────────────────────
  useEffect(() => {
    if (!user?.id) { setIsDataLoading(false); return; }

    const fetchCapsules = async () => {
      try {
        const { data: sentData } = await supabase
          .from('time_capsules').select('*')
          .eq('sender_id', user.id).order('created_at', { ascending: false });

        if (sentData) {
          const receiverIds = sentData.map(c => c.receiver_id);
          const { data: users } = await supabase.from('users').select('id, name').in('id', receiverIds);
          const userMap = new Map(users?.map(u => [u.id, u.name]) || []);
          setSentCapsules(sentData.map(c => ({ ...c, receiver_name: userMap.get(c.receiver_id) || '알 수 없음' })));
        }

        const { data: receivedData } = await supabase
          .from('time_capsules').select('*')
          .eq('receiver_id', user.id).order('unlock_at', { ascending: true });

        if (receivedData) {
          const senderIds = receivedData.map(c => c.sender_id);
          const { data: users } = await supabase.from('users').select('id, name').in('id', senderIds);
          const userMap = new Map(users?.map(u => [u.id, u.name]) || []);
          setReceivedCapsules(receivedData.map(c => ({ ...c, sender_name: userMap.get(c.sender_id) || '알 수 없음' })));
        }
      } catch (error) {
        console.error('Data load error:', error);
      } finally {
        setIsDataLoading(false);
      }
    };

    fetchCapsules();
  }, [user]);

  // ── 결제 및 페이지 이동 ───────────────────────────────
  const handlePaymentAndNavigate = async (type: 'capsule' | 'report') => {
    if (!user?.id) return;
    setIsPaymentLoading(true);
    setPaymentTarget(type);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      if (type === 'capsule') {
        toast.success('4,900원 결제 완료! 캡슐을 생성합니다.');
        navigate('/time-capsule/create');
      } else {
        toast.success('2,900원 결제 완료! 리포트를 분석합니다.');
        navigate('/main/contents/report');
      }
    } catch {
      toast.error('결제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsPaymentLoading(false);
      setPaymentTarget(null);
    }
  };

  // ── Helper Functions ──────────────────────────────────
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
    <div className="h-full w-full flex flex-col text-white" style={{ background: '#0d0d0d' }}>

      {/* ── 헤더 ────────────────────────────────────────── */}
      <header className="h-14 px-5 flex items-center sticky top-0 z-10"
        style={{ background: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h1 className="text-[18px] font-bold tracking-tight">그레인 콘텐츠</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-24" style={{ scrollbarWidth: 'none' }}>

        {/* ═══════════════════════════════════════════════
            SECTION 1: 타임캡슐
        ═══════════════════════════════════════════════ */}
        <section className="px-4 pt-5 pb-6">

          {/* 섹션 헤더 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(255,32,58,0.12)', color: '#FF203A' }}>
                타임캡슐
              </span>
            </div>
            <h2 className="text-[22px] font-bold tracking-tight mb-1">
              미래에게 보내는<br />감동 메시지
            </h2>
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              원하는 날짜에 열리는 편지를 지금 보내보세요
            </p>
          </div>

          {/* ── CTA 카드: 새 캡슐 보내기 ─────────────────── */}
          <button
            onClick={() => handlePaymentAndNavigate('capsule')}
            disabled={isPaymentLoading}
            className="w-full rounded-2xl p-5 mb-3 flex items-center justify-between transition-all active:scale-[0.98]"
            style={{
              background: '#FF203A',
              boxShadow: '0 8px 24px rgba(255,32,58,0.22)',
            }}
          >
            <div className="flex items-center gap-4">
              {/* 아이콘 */}
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.15)' }}>
                {isPaymentLoading && paymentTarget === 'capsule'
                  ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                  : <Send className="w-5 h-5 text-white" />
                }
              </div>
              {/* 텍스트 */}
              <div className="text-left">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-[16px] font-bold text-white tracking-tight">새 캡슐 보내기</p>
                </div>
                <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  소중한 사람에게 타임캡슐
                </p>
              </div>
            </div>
            {/* 가격 + 화살표 */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[15px] font-black text-white">₩4,900</span>
              <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
            </div>
          </button>

          {/* 신뢰 포인트 뱃지 3개 */}
          <div className="flex gap-2 mb-5">
            {[
              { icon: <ShieldCheck className="w-3 h-3" />, text: '안전 암호화' },
              { icon: <Clock className="w-3 h-3" />, text: '정확한 발송' },
              { icon: <Star className="w-3 h-3" />, text: '1건당 과금' },
            ].map(({ icon, text }) => (
              <div key={text}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>{icon}</span>
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* ── 탭 & 타임캡슐 리스트 ──────────────────────── */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>

            {/* 탭 */}
            <div className="flex"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              {(['sent', 'received'] as TabType[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-3.5 text-[13px] font-semibold transition-colors relative"
                  style={{
                    color: activeTab === tab ? 'white' : 'rgba(255,255,255,0.3)',
                    background: 'transparent',
                  }}
                >
                  {tab === 'sent'
                    ? `보낸 캡슐 ${sentCapsules.length > 0 ? `(${sentCapsules.length})` : ''}`
                    : `받은 캡슐 ${receivedCapsules.length > 0 ? `(${receivedCapsules.length})` : ''}`
                  }
                  {/* 활성 인디케이터 */}
                  {activeTab === tab && (
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-full"
                      style={{ background: '#FF203A' }} />
                  )}
                </button>
              ))}
            </div>

            {/* 리스트 내용 */}
            <div className="p-3 min-h-[140px]">
              {isDataLoading ? (
                <div className="flex flex-col items-center justify-center h-36 gap-2.5"
                  style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#FF203A' }} />
                  <span className="text-[12px]">불러오는 중</span>
                </div>
              ) : (activeTab === 'sent' ? sentCapsules : receivedCapsules).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-2.5"
                  style={{ color: 'rgba(255,255,255,0.15)' }}>
                  <Archive className="w-8 h-8" />
                  <p className="text-[12px]">
                    {activeTab === 'sent' ? '보낸 타임캡슐이 없습니다' : '받은 타임캡슐이 없습니다'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(activeTab === 'sent' ? sentCapsules : receivedCapsules).map(c => {
                    const locked = !canView(c);
                    const name = activeTab === 'sent' ? c.receiver_name : c.sender_name;

                    return (
                      <div
                        key={c.id}
                        onClick={() => !locked && activeTab === 'received' && navigate(`/time-capsule/view/${c.id}`)}
                        className="flex items-center justify-between px-3.5 py-3 rounded-xl transition-colors"
                        style={{
                          background: locked
                            ? 'rgba(255,255,255,0.03)'
                            : 'rgba(255,32,58,0.05)',
                          border: locked
                            ? '1px solid rgba(255,255,255,0.06)'
                            : '1px solid rgba(255,32,58,0.2)',
                          cursor: !locked && activeTab === 'received' ? 'pointer' : 'default',
                        }}
                      >
                        <div className="flex items-center gap-3">
                          {/* 잠금 아이콘 */}
                          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: locked
                                ? 'rgba(255,255,255,0.05)'
                                : 'rgba(255,32,58,0.1)',
                            }}>
                            {locked
                              ? <Lock className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.2)' }} />
                              : <Unlock className="w-3.5 h-3.5" style={{ color: '#FF203A' }} />
                            }
                          </div>
                          {/* 이름 + 시간 */}
                          <div>
                            <p className="text-[13px] font-semibold"
                              style={{ color: locked ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.82)' }}>
                              {name}
                            </p>
                            <div className="flex items-center gap-1 mt-0.5">
                              <Clock className="w-2.5 h-2.5" style={{ color: 'rgba(255,255,255,0.2)' }} />
                              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                {getTimeRemaining(c.unlock_at)}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* 수정 버튼 */}
                        {activeTab === 'sent' && canEdit(c) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/time-capsule/edit/${c.id}`); }}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                            style={{
                              background: 'rgba(255,255,255,0.07)',
                              color: 'rgba(255,255,255,0.5)',
                            }}
                          >
                            수정
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* 섹션 구분선 */}
        <div className="mx-4 h-[1px]" style={{ background: 'rgba(255,255,255,0.05)' }} />

        {/* ═══════════════════════════════════════════════
            SECTION 2: AI 연구소
        ═══════════════════════════════════════════════ */}
        <section className="px-4 pt-6 pb-6">

          {/* 섹션 헤더 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-bold tracking-[0.1em] uppercase px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(250,204,21,0.1)', color: '#FACC15' }}>
                AI 연구소
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold"
                style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.3)' }}>
                Beta
              </span>
            </div>
            <h2 className="text-[22px] font-bold tracking-tight mb-1">
              관계를 분석하면<br />대화가 달라집니다
            </h2>
            <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
              AI가 채팅 패턴을 읽고 인사이트를 제공해요
            </p>
          </div>

          {/* ── CTA 카드: AI 친구 리포트 ─────────────────── */}
          <button
            onClick={() => handlePaymentAndNavigate('report')}
            disabled={isPaymentLoading}
            className="w-full rounded-2xl p-5 mb-3 transition-all active:scale-[0.98]"
            style={{
              background: '#1a1a1a',
              border: '1px solid rgba(250,204,21,0.2)',
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(250,204,21,0.1)', border: '1px solid rgba(250,204,21,0.15)' }}>
                  {isPaymentLoading && paymentTarget === 'report'
                    ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#FACC15' }} />
                    : <Sparkles className="w-5 h-5" style={{ color: '#FACC15' }} />
                  }
                </div>
                <div className="text-left">
                  <p className="text-[16px] font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    AI 친구 리포트
                  </p>
                  <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                    관계 정밀 분석 · 맞춤형 솔루션
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[18px] font-black" style={{ color: '#FACC15' }}>₩2,900</span>
                <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
            </div>

            {/* 리포트 항목 미리보기 */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '관계 온도', value: '측정' },
                { label: '대화 패턴', value: '분석' },
                { label: '맞춤 솔루션', value: '제공' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl py-2.5 px-2 text-center"
                  style={{ background: 'rgba(250,204,21,0.05)', border: '1px solid rgba(250,204,21,0.1)' }}>
                  <p className="text-[10px] mb-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                  <p className="text-[12px] font-bold" style={{ color: 'rgba(250,204,21,0.8)' }}>{value}</p>
                </div>
              ))}
            </div>
          </button>

          {/* 신뢰 포인트 */}
          <div className="flex gap-2 mb-6">
            {[
              { icon: <Zap className="w-3 h-3" />, text: '즉시 분석' },
              { icon: <ShieldCheck className="w-3 h-3" />, text: '대화 비공개' },
              { icon: <Star className="w-3 h-3" />, text: '1건당 과금' },
            ].map(({ icon, text }) => (
              <div key={text}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <span style={{ color: 'rgba(255,255,255,0.25)' }}>{icon}</span>
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{text}</span>
              </div>
            ))}
          </div>

          {/* ── 준비 중 기능 그리드 ────────────────────────── */}
          <p className="text-[11px] font-semibold tracking-[0.08em] uppercase mb-3 px-1"
            style={{ color: 'rgba(255,255,255,0.2)' }}>
            곧 출시될 기능
          </p>
          <div className="grid grid-cols-2 gap-3">
            <FeatureCard icon={<MessageSquare className="w-4 h-4" />} title="채팅 도우미" desc="AI 답장 추천받기" />
            <FeatureCard icon={<ListTodo className="w-4 h-4" />} title="대화 요약" desc="3줄 핵심 요약" />
            <FeatureCard icon={<CalendarCheck className="w-4 h-4" />} title="일정 비서" desc="약속 자동 추출" />
            <FeatureCard icon={<FileBarChart className="w-4 h-4" />} title="서류 생성" desc="견적서 / 영수증" />
          </div>
        </section>

      </div>
    </div>
  );
}

// ── 준비중 기능 카드 ─────────────────────────────────────
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-2xl p-4 relative"
      style={{
        background: '#161616',
        border: '1px solid rgba(255,255,255,0.06)',
        opacity: 0.55,
      }}>
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
        style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' }}>
        {icon}
      </div>
      <p className="text-[13px] font-bold mb-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
        {title}
      </p>
      <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
        {desc}
      </p>
      <div className="absolute top-3 right-3 px-1.5 py-0.5 rounded-md text-[9px] font-bold tracking-wider"
        style={{
          background: 'rgba(255,255,255,0.05)',
          color: 'rgba(255,255,255,0.2)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}>
        준비중
      </div>
    </div>
  );
}