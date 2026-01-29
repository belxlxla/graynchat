import { useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, ChevronRight, 
  UserCog, ShieldCheck, Lock 
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function SecurityPage() {
  const navigate = useNavigate();

  const handleMenuClick = (menu: string) => {
    if (menu === '개인정보 관리') {
      navigate('/settings/security/privacy');
    } else if (menu === '보안 설정') {
      // ✨ 신규 보안 상세 페이지(AccountSecurityPage)로 연결되는 정확한 경로
      // App.tsx에서 설정한 경로와 일치해야 합니다.
      navigate('/settings/security/account');
    } else if (menu === '화면 잠금') {
      navigate('/settings/security/lock'); 
    } else {
      toast(`${menu} 기능은 준비 중입니다.`);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === Header === */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 text-white hover:text-brand-DEFAULT transition-colors"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">개인/보안</h1>
      </header>

      {/* === Content === */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pt-4">
        
        <div className="px-5 space-y-6">
          
          {/* Section 1: 개인정보 */}
          <Section label="개인정보">
            <ListItem 
              icon={<UserCog className="w-5 h-5 text-[#8E8E93]" />} 
              label="개인정보 관리" 
              onClick={() => handleMenuClick('개인정보 관리')} 
            />
          </Section>

          {/* Section 2: 보안 */}
          <Section label="보안">
            <ListItem 
              // ✨ 아이콘을 ShieldCheck로 유지
              icon={<ShieldCheck className="w-5 h-5 text-[#8E8E93]" />} 
              label="보안 설정" 
              onClick={() => handleMenuClick('보안 설정')} 
            />
            <div className="h-[1px] bg-[#3A3A3C] mx-4" />
            <ListItem 
              icon={<Lock className="w-5 h-5 text-[#8E8E93]" />} 
              label="화면 잠금" 
              value="사용 안 함" 
              onClick={() => handleMenuClick('화면 잠금')} 
            />
          </Section>

        </div>
      </div>
    </div>
  );
}

// === [Sub Components] ===

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2 uppercase tracking-wider">{label}</h3>
      <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
        {children}
      </div>
    </div>
  );
}

function ListItem({ 
  icon, 
  label, 
  value, 
  onClick 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value?: string;
  onClick: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group text-left"
    >
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 flex justify-center items-center">
          {icon}
        </div>
        <span className="text-[15px] text-white font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-[13px] text-[#8E8E93]">{value}</span>}
        <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93] transition-colors" />
      </div>
    </button>
  );
}