import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Search, ChevronDown, ChevronRight,
  Mail, FileText, MessageCircle, HelpCircle, X
} from 'lucide-react';
import toast from 'react-hot-toast';

// === [Mock Data: 추후 API로 대체 가능] ===
const FAQ_DATA = [
  {
    id: 1,
    question: '그레인에 등록된 전화번호를 바꾸고 싶어요',
    answer: '휴대폰 번호 변경은 [설정 > 그레인 계정정보 > 전화번호나 이름 터치] 에서 가능합니다. 새로운 번호로 SMS 인증을 완료하면 즉시 반영됩니다. 계정 정보는 안전하게 유지됩니다.',
  },
  {
    id: 2,
    question: '프로필에 표시되는 AI 지수는 무엇인가요?',
    answer: 'AI 지수는 사용자의 활동 패턴, 매너 온도, 커뮤니티 기여도를 종합적으로 분석하여 산출된 신뢰도 지표입니다. 높은 AI 지수는 더 많은 신뢰를 의미합니다.',
  },
  {
    id: 3,
    question: '유명인, 은행 및 기관을 사칭하는 메시지를 수신했어요. 어떻게 대처해야 하나요?',
    answer: '그레인은 절대 개인 정보나 금전을 요구하지 않습니다. 사칭 메시지를 받으셨다면 대화를 중단하고, 채팅방 우측 상단 메뉴의 [신고하기]를 통해 즉시 신고해 주세요.',
  },
  {
    id: 4,
    question: '인증문자가 오지 않아요. 어떻게 해야 하나요?',
    answer: '통신사의 스팸 차단 서비스가 가입되어 있는지 확인해 주세요. 1544-XXXX 번호가 차단되어 있다면 해제 후 다시 시도해 주세요. 여전히 문제가 지속되면 고객센터로 문의 바랍니다.',
  },
];

const POLICY_LIST = [
  '이용약관',
  '위치기반서비스 이용약관',
  '개인정보처리방침',
  '민감정보 수집 및 이용 동의',
  '운영정책',
  '청소년보호정책',
  '맞춤형 광고 안내',
  '그레인 신고센터',
];

export default function CustomerServicePage() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<number | null>(null);

  const toggleFaq = (id: number) => {
    setExpandedFaqId(expandedFaqId === id ? null : id);
  };

  const handleContact = () => {
    window.location.href = 'mailto:balla@vanishst.com';
  };

  const handlePolicyClick = (title: string) => {
    const externalPolicies = [
      '이용약관', '위치기반서비스 이용약관', '개인정보처리방침',
      '민감정보 수집 및 이용 동의', '운영정책', '청소년보호정책', '맞춤형 광고 안내',
    ];
    if (externalPolicies.includes(title)) {
      window.open('https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link', '_blank');
    } else if (title === '그레인 신고센터') {
      navigate('/settings/help/report');
    } else {
      toast(`${title} 페이지로 이동합니다. (준비중)`);
    }
  };

  const filteredFaq = FAQ_DATA.filter(item => item.question.includes(searchQuery));

  return (
    <div className="flex flex-col h-[100dvh] text-white overflow-hidden"
      style={{ background: '#0d0d0d' }}>

      {/* ── 헤더 ─────────────────────────────────────────── */}
      <header className="h-14 px-2 flex items-center shrink-0 z-10"
        style={{ background: '#0d0d0d', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => navigate(-1)}
          className="p-2 transition-colors"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-[16px] font-bold ml-1 tracking-tight">고객센터 / 운영정책</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-10" style={{ scrollbarWidth: 'none' }}>

        {/* ── 1. 인사 & 검색 ─────────────────────────────── */}
        <div className="px-5 pt-7 pb-6">
          {/* 인사 텍스트 */}
          <div className="flex items-start gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5"
              style={{ background: 'rgba(255,32,58,0.1)', border: '1px solid rgba(255,32,58,0.18)' }}>
              <MessageCircle className="w-5 h-5" style={{ color: '#FF203A' }} />
            </div>
            <div>
              <p className="text-[18px] font-bold leading-snug tracking-tight mb-1">
                안녕하세요, 그레인입니다.
              </p>
              <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                무엇을 도와드릴까요?
              </p>
            </div>
          </div>

          {/* 검색창 */}
          <div className="flex items-center gap-2.5 rounded-xl px-4 py-3"
            style={{
              background: '#1a1a1a',
              border: searchQuery
                ? '1px solid rgba(255,32,58,0.3)'
                : '1px solid rgba(255,255,255,0.08)',
            }}>
            <Search className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
            <input
              type="text"
              placeholder="궁금한 내용을 검색해보세요"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent w-full text-[14px] focus:outline-none placeholder-white/20"
              style={{ color: 'rgba(255,255,255,0.82)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
              </button>
            )}
          </div>
        </div>

        {/* ── 2. FAQ 섹션 ────────────────────────────────── */}
        <div className="px-5 mb-4">
          {/* 섹션 레이블 */}
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
            <span className="text-[11px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              자주 묻는 질문
            </span>
            {searchQuery && (
              <span className="text-[11px] ml-auto"
                style={{ color: 'rgba(255,255,255,0.2)' }}>
                {filteredFaq.length}개
              </span>
            )}
          </div>

          {/* FAQ 리스트 */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
            {filteredFaq.length > 0 ? (
              filteredFaq.map((item, index) => (
                <div key={item.id}>
                  {/* 질문 버튼 */}
                  <button
                    onClick={() => toggleFaq(item.id)}
                    className="w-full flex items-start justify-between px-4 py-4 text-left transition-colors"
                    style={{
                      background: expandedFaqId === item.id
                        ? 'rgba(255,32,58,0.04)'
                        : 'transparent',
                    }}
                  >
                    <div className="flex items-start gap-3 flex-1 pr-3">
                      {/* Q 뱃지 */}
                      <span className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black mt-0.5"
                        style={{
                          background: expandedFaqId === item.id
                            ? 'rgba(255,32,58,0.15)'
                            : 'rgba(255,255,255,0.07)',
                          color: expandedFaqId === item.id
                            ? '#FF203A'
                            : 'rgba(255,255,255,0.3)',
                        }}>
                        Q
                      </span>
                      <span className="text-[14px] leading-snug"
                        style={{ color: 'rgba(255,255,255,0.82)' }}>
                        {item.question}
                      </span>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedFaqId === item.id ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0 mt-0.5"
                    >
                      <ChevronDown className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.2)' }} />
                    </motion.div>
                  </button>

                  {/* 답변 */}
                  <AnimatePresence>
                    {expandedFaqId === item.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 pt-0">
                          <div className="flex gap-3">
                            {/* A 뱃지 */}
                            <span className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black mt-0.5"
                              style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.2)' }}>
                              A
                            </span>
                            <p className="text-[13px] leading-relaxed whitespace-pre-wrap"
                              style={{ color: 'rgba(255,255,255,0.45)' }}>
                              {item.answer}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 구분선 */}
                  {index < filteredFaq.length - 1 && (
                    <div className="mx-4 h-[1px]"
                      style={{ background: 'rgba(255,255,255,0.05)' }} />
                  )}
                </div>
              ))
            ) : (
              <div className="py-14 flex flex-col items-center gap-2"
                style={{ color: 'rgba(255,255,255,0.2)' }}>
                <Search className="w-8 h-8 opacity-40" />
                <p className="text-[13px]">검색 결과가 없습니다</p>
              </div>
            )}
          </div>
        </div>

        {/* ── 3. 문의 카드 ───────────────────────────────── */}
        <div className="px-5 mb-4">
          <div className="rounded-2xl p-5"
            style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Mail className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
              </div>
              <div>
                <p className="text-[14px] font-semibold mb-0.5" style={{ color: 'rgba(255,255,255,0.82)' }}>
                  도움말로 해결되지 않으셨나요?
                </p>
                <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  메일로 빠르게 답변 드립니다
                </p>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleContact}
              className="w-full py-3 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2"
              style={{ background: '#FF203A', color: 'white' }}
            >
              <Mail className="w-4 h-4" />
              이메일로 문의하기
            </motion.button>
          </div>
        </div>

        {/* ── 4. 약관 및 정책 ────────────────────────────── */}
        <div className="px-5 mb-4">
          {/* 섹션 레이블 */}
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
            <span className="text-[11px] font-semibold tracking-[0.08em] uppercase"
              style={{ color: 'rgba(255,255,255,0.25)' }}>
              약관 및 정책
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden"
            style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
            {POLICY_LIST.map((policy, idx) => (
              <div key={idx}>
                <motion.button
                  whileTap={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
                  onClick={() => handlePolicyClick(policy)}
                  className="w-full flex items-center justify-between px-4 py-3.5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* 특별 항목 강조 */}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: policy === '그레인 신고센터'
                          ? 'rgba(255,32,58,0.1)'
                          : 'rgba(255,255,255,0.05)',
                      }}>
                      <FileText className="w-3.5 h-3.5"
                        style={{
                          color: policy === '그레인 신고센터'
                            ? '#FF203A'
                            : 'rgba(255,255,255,0.3)',
                        }} />
                    </div>
                    <span className="text-[14px]"
                      style={{
                        color: policy === '그레인 신고센터'
                          ? 'rgba(255,255,255,0.82)'
                          : 'rgba(255,255,255,0.65)',
                      }}>
                      {policy}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5"
                    style={{ color: 'rgba(255,255,255,0.18)' }} />
                </motion.button>
                {idx < POLICY_LIST.length - 1 && (
                  <div className="mx-4 h-[1px]"
                    style={{ background: 'rgba(255,255,255,0.05)' }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── 5. 회사 정보 푸터 ─────────────────────────── */}
        <div className="px-5 pt-2 pb-10">
          <div className="rounded-2xl p-5"
            style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="text-[12px] font-semibold mb-3"
              style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.02em' }}>
              (주)바니쉬스테레오타입
            </p>
            <div className="space-y-1.5 text-[11px] leading-relaxed"
              style={{ color: 'rgba(255,255,255,0.2)' }}>
              <p>대표 임정민 · 사업자등록번호 376-88-02714</p>
              <p>통신판매업신고번호 제 2025-경기하남-3042</p>
              <p className="leading-relaxed">
                경기도 하남시 미사대로 550 현대지식산업센터 1차 10층 씨-0010호 브이47
              </p>
              <p className="pt-1">
                고객센터{' '}
                <a
                  href="mailto:balla@vanishst.com"
                  className="transition-colors"
                  style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'underline', textDecorationColor: 'rgba(255,255,255,0.15)' }}
                >
                  balla@vanishst.com
                </a>
              </p>
              <p>호스팅 사업자 (주)바니쉬스테레오타입</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}