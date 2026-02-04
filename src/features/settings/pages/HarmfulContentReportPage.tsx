import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldAlert, FileText, CheckCircle2, Send } from 'lucide-react';

export default function HarmfulContentReportPage() {
  const navigate = useNavigate();

  const handleOpenEmail = () => {
    // 이메일 본문 템플릿
    const emailBody = [
      '='.repeat(50),
      '그레인(GRAYN) 유해정보 신고',
      '='.repeat(50),
      '',
      '[신고자 정보]',
      '이름: ',
      '이메일: ',
      '',
      '[신고 대상]',
      '콘텐츠 유형: ',
      '콘텐츠 위치/URL: ',
      '',
      '[신고 사유]',
      '(음란물/성적 콘텐츠, 폭력적/혐오 콘텐츠, 불법 정보, 개인정보 침해, 명예훼손/모욕, 스팸/광고, 저작권 침해, 청소년 유해 정보, 기타 중 선택)',
      '',
      '[상세 설명]',
      '',
      '',
      '',
      '='.repeat(50),
      `신고 접수 시각: ${new Date().toLocaleString('ko-KR')}`,
      '='.repeat(50)
    ].join('\n');

    // mailto 링크 생성
    const subject = encodeURIComponent('[그레인] 유해정보 신고');
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
        <h1 className="text-lg font-bold ml-1">유해 정보 신고하기</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        <div className="p-6 pt-10 text-center border-b border-[#2C2C2E]">
          <div className="w-16 h-16 bg-[#2C2C2E] rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-8 h-8 text-[#FF203A]" />
          </div>
          <h2 className="text-xl font-bold mb-4">
            안전하고 깨끗한<br/>그레인을 만듭니다
          </h2>
          <div className="text-[13px] text-[#8E8E93] leading-relaxed text-left bg-[#2C2C2E] p-5 rounded-2xl">
            그레인은 모든 사용자가 자유롭게 이용할 수 있는 공간으로써 
            유해 정보로부터 청소년 및 약자를 보호하고 안전한 인터넷 사용을 돕기 위해 
            <span className="text-[#E5E5EA] font-medium"> 정보통신망 이용촉진 및 정보보호 등에 관한 법률</span>에서 정한 
            청소년 보호정책을 시행하고 있습니다.
          </div>
        </div>

        <div className="p-6 space-y-8">
          
          <div className="pb-2 border-b border-[#3A3A3C]">
            <h3 className="text-lg font-bold text-white">유해 정보 신고방법 및 처리절차</h3>
          </div>

          <section className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-brand-DEFAULT" />
              <h4 className="text-[15px] font-bold text-white">신고 방법</h4>
            </div>
            <div className="space-y-4 text-[13px] text-[#8E8E93] leading-7 pl-1">
              <p>
                <span className="text-[#E5E5EA] font-bold mr-1">1.</span>
                사용자에게 공개된 모든 콘텐츠는 서비스 내 <span className="text-[#E5E5EA] underline underline-offset-4 decoration-brand-DEFAULT">신고하기 기능</span>을 이용하여 신고를 할 수 있습니다.
              </p>
              <p>
                <span className="text-[#E5E5EA] font-bold mr-1">2.</span>
                신고가 접수되면 그레인 운영정책 위반 여부를 검토하여 제재가 결정되며, 이에 따라 최종적으로 서비스 이용제한 조치가 적용될 수 있습니다.
              </p>
              <p>
                <span className="text-[#E5E5EA] font-bold mr-1">3.</span>
                서비스별 신고하기 방법은 아래의 도움말을 확인해주시고 그 외 서비스는 그레인 고객센터를 통해 확인할 수 있습니다.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-brand-DEFAULT" />
              <h4 className="text-[15px] font-bold text-white">처리 절차</h4>
            </div>
            <div className="bg-[#2C2C2E] p-4 rounded-xl border border-[#3A3A3C]">
              <p className="text-[13px] text-[#D1D1D6] leading-relaxed">
                유해정보로 신고된 게시물은 그레인 이용약관 및 운영원칙에 따라 
                <span className="text-[#FF203A] font-bold"> 신속하게 조치를 취하고 있습니다.</span>
                <br/>
                검토 결과에 따라 게시물 삭제, 작성자 이용 정지 등의 조치가 이루어질 수 있습니다.
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
            유해 정보 신고하기
          </button>
        </div>

        <div className="px-6 pb-8">
          <p className="text-[11px] text-[#48484A] text-center leading-relaxed">
            허위 신고 시, 신고자에 대한 불이익이 발생할 수 있으니<br/>
            신중하게 신고해 주시기 바랍니다.
          </p>
        </div>

      </div>
    </div>
  );
}