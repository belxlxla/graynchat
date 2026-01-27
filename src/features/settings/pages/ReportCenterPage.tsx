import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Siren, Scale, Camera, Activity, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ReportCenterPage() {
  const navigate = useNavigate();

  // State for diagnostics
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectComplete, setInspectComplete] = useState(false);

  // Handlers
  const handleReportClick = (title: string) => {
    toast(`${title} 페이지로 이동합니다. (준비중)`);
  };

  const handleInspect = () => {
    if (isInspecting || inspectComplete) return;
    
    setIsInspecting(true);
    toast('네트워크 및 데이터 무결성 검사를 시작합니다...');

    // 검사 시뮬레이션 (3초)
    setTimeout(() => {
      setIsInspecting(false);
      setInspectComplete(true);
      toast.success('검사가 완료되었습니다. 문의하기를 통해 결과를 전송할 수 있습니다.');
    }, 3000);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* Header */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">그레인 신고센터</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        {/* 1. Title Section */}
        <div className="p-6 pt-8">
          <h2 className="text-2xl font-bold leading-tight">
            언제든지 그레인에게<br/>말씀해주세요
          </h2>
        </div>

        <div className="px-5 space-y-6">
          
          {/* 2. Report List */}
          <div className="space-y-4">
            <ReportItem 
              icon={<Siren className="w-5 h-5 text-[#FF453A]" />}
              title="유해 정보 신고하기"
              desc="음란, 불법 게시물을 발견하셨나요? 여러분의 제보로 더 깨끗한 서비스를 만들어가도록 노력하겠습니다."
              onClick={() => handleReportClick('유해 정보 신고')}
            />
            <ReportItem 
              icon={<Scale className="w-5 h-5 text-brand-DEFAULT" />}
              title="권리침해 신고하기"
              desc="공개 게시물로 인한 명예훼손, 저작권 침해 등 본인의 권리침해로 곤란을 겪고 계신가요? 권리침해 신고를 이용해 주시기 바랍니다."
              onClick={() => handleReportClick('권리침해 신고')}
            />
            <ReportItem 
              icon={<Camera className="w-5 h-5 text-[#BF5AF2]" />}
              title="불법촬영물 등 유통 신고"
              desc="불법촬영물 등이 유통되는 것을 목격하거나 발견하셨나요? 전기통신사업법 시행령에 따라 유통방지에 필요한 조치를 요청할 수 있습니다."
              onClick={() => handleReportClick('불법촬영물 신고')}
            />
          </div>

          <div className="h-[1px] bg-[#2C2C2E] mx-2" />

          {/* 3. Diagnostics Section */}
          <div className="bg-[#2C2C2E] rounded-2xl p-5 border border-[#3A3A3C]">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#8E8E93]" />
                <span className="text-[15px] font-bold text-white">정보수집 및 오류보고</span>
              </div>
              
              <button 
                onClick={handleInspect}
                disabled={isInspecting || inspectComplete}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 ${
                  inspectComplete 
                    ? 'bg-green-500/20 text-green-500 cursor-default' 
                    : isInspecting 
                      ? 'bg-[#3A3A3C] text-[#8E8E93] cursor-wait' 
                      : 'bg-brand-DEFAULT text-white hover:bg-brand-hover'
                }`}
              >
                {isInspecting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" /> 검사 중...
                  </>
                ) : inspectComplete ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" /> 검사 완료
                  </>
                ) : (
                  '검사하기'
                )}
              </button>
            </div>

            <div className="space-y-2 text-[12px] text-[#8E8E93] leading-relaxed pl-1">
              <p className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>검사 결과는 네트워크 상태 및 필수 데이터 손상 여부 등을 판단하여 서비스를 개선하는 목적으로 활용됩니다.</span>
              </p>
              <p className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>임시 데이터 삭제 후 문제가 반복되는 경우 검사를 진행해 주세요.</span>
              </p>
              <p className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>검사 시간은 최대 5분 소요될 수 있습니다.</span>
              </p>
              <p className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>검사 완료 후 문의하기를 클릭하면 검사 결과가 자동으로 첨부됩니다.</span>
              </p>
              <p className="flex gap-2">
                <span className="shrink-0">•</span>
                <span>겪고 있는 증상을 상세히 기재해주시면 그레인에서 문제를 빠르게 해결하는 데 큰 도움이 됩니다.</span>
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// === Sub Component ===
function ReportItem({ icon, title, desc, onClick }: { icon: React.ReactNode, title: string, desc: string, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="w-full text-left bg-[#2C2C2E] hover:bg-[#3A3A3C] active:bg-[#48484A] rounded-2xl p-5 transition-colors border border-[#3A3A3C] group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          {icon}
          <span className="text-[15px] font-bold text-white">{title}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93] transition-colors" />
      </div>
      <p className="text-[13px] text-[#8E8E93] leading-relaxed">
        {desc}
      </p>
    </button>
  );
}