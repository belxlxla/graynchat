import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Search, ChevronDown, ChevronRight, Mail, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

// === [Mock Data: 추후 API로 대체 가능] ===
const FAQ_DATA = [
  {
    id: 1,
    question: '그레인에 등록된 전화번호를 바꾸고 싶어요',
    answer: '휴대폰 번호 변경은 [설정 > 계정 > 전화번호 변경] 메뉴에서 가능합니다. 새로운 번호로 SMS 인증을 완료하면 즉시 반영됩니다. 계정 정보는 안전하게 유지됩니다.'
  },
  {
    id: 2,
    question: '프로필에 표시되는 AI 지수는 무엇인가요?',
    answer: 'AI 지수는 사용자의 활동 패턴, 매너 온도, 커뮤니티 기여도를 종합적으로 분석하여 산출된 신뢰도 지표입니다. 높은 AI 지수는 더 많은 신뢰를 의미합니다.'
  },
  {
    id: 3,
    question: '유명인, 은행 및 기관을 사칭하는 메시지를 수신했어요. 어떻게 대처해야 하나요?',
    answer: '그레인은 절대 개인 정보나 금전을 요구하지 않습니다. 사칭 메시지를 받으셨다면 대화를 중단하고, 채팅방 우측 상단 메뉴의 [신고하기]를 통해 즉시 신고해 주세요.'
  },
  {
    id: 4,
    question: '인증문자가 오지 않아요. 어떻게 해야 하나요?',
    answer: '통신사의 스팸 차단 서비스가 가입되어 있는지 확인해 주세요. 1544-XXXX 번호가 차단되어 있다면 해제 후 다시 시도해 주세요. 여전히 문제가 지속되면 고객센터로 문의 바랍니다.'
  }
];

const POLICY_LIST = [
  '이용약관',
  '위치기반서비스 이용약관',
  '개인정보처리방침',
  '민감정보 수집 및 이용 동의', // ✨ 새로 추가된 항목
  '운영정책',
  '청소년보호정책',
  '맞춤형 광고 안내',
  '그레인 신고센터',
];

export default function CustomerServicePage() {
  const navigate = useNavigate();

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaqId, setExpandedFaqId] = useState<number | null>(null);

  // Handlers
  const toggleFaq = (id: number) => {
    setExpandedFaqId(expandedFaqId === id ? null : id);
  };

  const handleContact = () => {
    window.location.href = 'mailto:balla@vanishst.com';
  };

  // ✨ 수정된 정책 클릭 핸들러
  const handlePolicyClick = (title: string) => {
    // 외부 브라우저(노션)로 열릴 항목들
    const externalPolicies = [
      '이용약관',
      '위치기반서비스 이용약관',
      '개인정보처리방침',
      '민감정보 수집 및 이용 동의', // ✨ 노션 연결 목록에 추가
      '운영정책',
      '청소년보호정책',
      '맞춤형 광고 안내'
    ];

    if (externalPolicies.includes(title)) {
      // 실제 노션 페이지 URL로 연결
      window.open('https://www.notion.so/GRAYN-2f7f8581f9c880cab6afced062c24748?source=copy_link', '_blank');
    } else if (title === '그레인 신고센터') {
      navigate('/settings/help/report'); // ✨ 신고센터 페이지로 이동
    } else {
      toast(`${title} 페이지로 이동합니다. (준비중)`);
    }
  };

  // Filter Logic
  const filteredFaq = FAQ_DATA.filter(item => 
    item.question.includes(searchQuery)
  );

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* Header */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">그레인 고객센터/운영정책</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        {/* 1. Greeting & Search */}
        <div className="p-5 pb-8 bg-[#1C1C1E] border-b border-[#2C2C2E]">
          <h2 className="text-xl font-bold mb-4 leading-relaxed">
            안녕하세요 그레인입니다.<br/>
            무엇을 도와드릴까요?
          </h2>
          <div className="bg-[#2C2C2E] rounded-xl flex items-center px-4 py-3 border border-[#3A3A3C]">
            <Search className="w-5 h-5 text-[#8E8E93] mr-2" />
            <input 
              type="text" 
              placeholder="궁금한 내용을 검색해보세요" 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="bg-transparent text-white w-full text-[15px] placeholder-[#636366] focus:outline-none" 
            />
          </div>
        </div>

        {/* 2. FAQ Section */}
        <div className="p-5">
          <h3 className="text-sm font-bold text-[#8E8E93] mb-3">자주 묻는 질문</h3>
          <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C]">
            {filteredFaq.length > 0 ? (
              filteredFaq.map((item) => (
                <div key={item.id}>
                  <button 
                    onClick={() => toggleFaq(item.id)}
                    className="w-full flex items-start justify-between p-4 text-left hover:bg-[#3A3A3C] transition-colors"
                  >
                    <span className="text-[15px] font-medium leading-snug pr-4">{item.question}</span>
                    <ChevronDown className={`w-5 h-5 text-[#8E8E93] shrink-0 transition-transform duration-300 ${expandedFaqId === item.id ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {expandedFaqId === item.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }} 
                        animate={{ height: 'auto', opacity: 1 }} 
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-[#252527]"
                      >
                        <div className="p-4 text-[14px] text-[#D1D1D6] leading-relaxed whitespace-pre-wrap">
                          {item.answer}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-[#8E8E93] text-sm">
                검색 결과가 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* 3. Contact Section */}
        <div className="px-5 mb-8">
          <div className="bg-[#2C2C2E] rounded-2xl p-5 border border-[#3A3A3C]">
            <p className="text-[15px] font-bold mb-1">도움말을 통해 문제를 해결하지 못하셨나요?</p>
            <p className="text-[13px] text-[#8E8E93] mb-4">간편하게 메일로 답변을 받을 수 있어요.</p>
            <button 
              onClick={handleContact}
              className="w-full py-3 bg-brand-DEFAULT rounded-xl text-white font-bold text-sm hover:bg-brand-hover transition-colors flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              문의하기
            </button>
          </div>
        </div>

        {/* 4. Policy Section */}
        <div className="px-5 pb-8">
          <h3 className="text-sm font-bold text-[#8E8E93] mb-3">약관 및 정책 등</h3>
          <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C]">
            {POLICY_LIST.map((policy, idx) => (
              <button 
                key={idx} 
                onClick={() => handlePolicyClick(policy)}
                className="w-full flex items-center justify-between p-4 hover:bg-[#3A3A3C] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-[#8E8E93]" />
                  <span className="text-[14px] text-white">{policy}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
              </button>
            ))}
          </div>
        </div>

        {/* 5. Footer (Company Info) */}
        <div className="px-6 pb-12 pt-4">
          <h4 className="text-[13px] font-bold text-[#636366] mb-2">(주)바니쉬스테레오타입</h4>
          <div className="text-[11px] text-[#48484A] space-y-1 leading-relaxed">
            <p>대표: 임정민 <span className="mx-1">|</span> 사업자등록번호: 376-88-02714</p>
            <p>통신판매업신고번호: 제 2025-경기하남-3042</p>
            <p>주소: 경기도 하남시 미사대로 550 현대지식산업센터 1차 10층 씨-0010호 브이47</p>
            <p>그레인 고객센터: <a href="mailto:balla@vanishst.com" className="underline decoration-[#48484A]">balla@vanishst.com</a></p>
            <p className="pt-2">호스팅 사업자 (주)바니쉬스테레오타입</p>
          </div>
        </div>

      </div>
    </div>
  );
}