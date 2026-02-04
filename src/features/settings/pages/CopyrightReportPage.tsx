import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Scale, AlertCircle, Info, Send } from 'lucide-react';

export default function CopyrightReportPage() {
  const navigate = useNavigate();

  const handleOpenEmail = () => {
    // 이메일 본문 템플릿
    const emailBody = [
      '='.repeat(50),
      '그레인(GRAYN) 권리침해 신고',
      '='.repeat(50),
      '',
      '[신고자 정보]',
      '이름: ',
      '이메일: ',
      '연락처: ',
      '',
      '[권리침해 유형]',
      '(저작권 침해, 초상권 침해, 명예훼손, 개인정보 침해, 상표권 침해, 기타 중 선택)',
      '',
      '[침해 대상 게시물]',
      '게시물 URL: ',
      '게시물 설명: ',
      '',
      '[권리 소유자 정보]',
      '권리 소유자: ',
      '권리 관계: (본인/대리인/기타)',
      '',
      '[침해 내용 및 사유]',
      '',
      '',
      '',
      '[첨부 증빙 서류]',
      '(신분증 사본, 권리 증명 서류, 위임장(대리인의 경우) 등)',
      '',
      '',
      '='.repeat(50),
      `신고 접수 시각: ${new Date().toLocaleString('ko-KR')}`,
      '='.repeat(50),
      '',
      '※ 본 신고는 정당한 권리 보호를 위한 것이며, 허위 신고 시 법적 책임을 질 수 있습니다.'
    ].join('\n');

    // mailto 링크 생성
    const subject = encodeURIComponent('[그레인] 권리침해 신고');
    const body = encodeURIComponent(emailBody);
    const mailtoUrl = `mailto:bella@vanishst.com?subject=${subject}&body=${body}`;
    
    // 이메일 클라이언트 열기
    window.open(mailtoUrl, '_blank');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">권리침해 신고하기</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        <div className="p-6 pt-10 text-center border-b border-[#2C2C2E]">
          <div className="w-16 h-16 bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-6">
            <Scale className="w-8 h-8 text-brand-DEFAULT" />
          </div>
          <h2 className="text-xl font-bold mb-2">
            권리침해 신고
          </h2>
          <p className="text-[13px] text-[#8E8E93] leading-relaxed">
            타인의 권리를 보호하고 건전한 서비스 환경을<br/>
            조성하기 위해 노력하고 있습니다.
          </p>
        </div>

        <div className="p-6 space-y-8">
          
          <section>
            <h3 className="text-[15px] font-bold text-white mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-[#8E8E93]" />
              신고 안내
            </h3>
            
            <div className="bg-[#2C2C2E] rounded-2xl p-5 border border-[#3A3A3C]">
              <ul className="space-y-4 text-[13px] text-[#D1D1D6] leading-relaxed">
                <li className="flex gap-3">
                  <span className="shrink-0 text-[#8E8E93]">•</span>
                  <span>
                    공개된 게시물로 인하여 권리침해 피해가 발생될 경우 침해 사실에 맞게 신고를 해주시기 바랍니다.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 text-[#8E8E93]">•</span>
                  <span>
                    증빙서류 요건이 충족되지 않을 경우 메일을 통하여 추가 보완 요청을 드립니다.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 text-[#8E8E93]">•</span>
                  <span>
                    게시물 주소(URL)가 없을 경우 서비스 앱에서 신고를 먼저 하시고 나서 서류를 보내주시기 바랍니다.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 text-[#8E8E93]">•</span>
                  <span>
                    그레인 프로필 사칭 피해는 <span className="text-white font-medium underline underline-offset-4">불법촬영물 등 유통 신고</span>를 이용해 주시기 바랍니다.
                  </span>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h3 className="text-[15px] font-bold text-[#FF203A] mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              유의사항
            </h3>
            
            <div className="px-1 text-[13px] text-[#8E8E93] leading-7">
              <p>
                정당한 침해 사유가 없이 권리침해신고를 하거나, 신고내용이 허위일 경우에는 
                <span className="text-[#E5E5EA]"> 표현의 자유를 침해</span>할 수 있습니다.
              </p>
              <p className="mt-2">
                내용이 공익성이 있는 건전한 비판인 경우에는 접수를 보다 신중하게 판단해주시기 바랍니다.
              </p>
            </div>
          </section>

        </div>

        {/* 신고하기 버튼 */}
        <div className="px-6 pb-6">
          <button
            onClick={handleOpenEmail}
            className="w-full h-14 bg-brand-DEFAULT hover:bg-brand-hover text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg active:scale-[0.98]"
          >
            <Send className="w-5 h-5" />
            권리침해 신고하기
          </button>
        </div>

        <div className="px-6 pb-8">
          <p className="text-[11px] text-[#48484A] text-center leading-relaxed">
            허위 신고 시 법적 책임이 발생할 수 있으니<br/>
            정확한 정보를 바탕으로 신중하게 신고해 주시기 바랍니다.
          </p>
        </div>

      </div>
    </div>
  );
}