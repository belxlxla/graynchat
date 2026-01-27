import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion'; // ✨ AnimatePresence 제거됨
import { ChevronLeft, Lock, Shield, Eye, FileText, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PrivacyManagementPage() {
  const navigate = useNavigate();

  const [toggles, setToggles] = useState({
    idSearch: true,
    recommend: true,
  });

  const handleToggle = (key: keyof typeof toggles) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
    toast.success('설정이 변경되었습니다.');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">개인/보안</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 space-y-8">
        
        {/* 1. Security */}
        <Section title="보안">
          <button onClick={() => navigate('/settings/security/lock')} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] transition-colors group">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-[#8E8E93]" />
              <span className="text-[15px] text-white">화면 잠금</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] text-[#8E8E93]">사용 안 함</span>
              <ChevronRight className="w-4 h-4 text-[#636366]" />
            </div>
          </button>
          <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] transition-colors group">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#8E8E93]" />
              <span className="text-[15px] text-white">로그인 기기 관리</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#636366]" />
          </button>
        </Section>

        {/* 2. Privacy */}
        <Section title="프라이버시">
          <ToggleItem 
            icon={<Eye className="w-5 h-5" />} 
            label="ID로 친구 추가 허용" 
            checked={toggles.idSearch} 
            onChange={() => handleToggle('idSearch')} 
          />
          <ToggleItem 
            icon={<FileText className="w-5 h-5" />} 
            label="친구 추천 허용" 
            checked={toggles.recommend} 
            onChange={() => handleToggle('recommend')} 
          />
        </Section>

        {/* 3. Data */}
        <Section title="데이터 관리">
          <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] transition-colors text-left">
            <span className="text-[15px] text-[#FF453A]">모든 데이터 삭제</span>
          </button>
        </Section>

      </div>
    </div>
  );
}

// === Sub Components ===

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2">{title}</h3>
      <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C]">
        {children}
      </div>
    </div>
  );
}

function ToggleItem({ 
  icon, label, checked, onChange 
}: { 
  icon: React.ReactNode, label: string, checked: boolean, onChange: () => void 
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="text-[#8E8E93]">{icon}</div>
        <span className="text-[15px] text-white">{label}</span>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean, onChange: () => void }) {
  return (
    <button 
      onClick={onChange}
      className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out ${checked ? 'bg-brand-DEFAULT' : 'bg-[#48484A]'}`}
    >
      <motion.div 
        className="w-5 h-5 bg-white rounded-full shadow-sm"
        animate={{ x: checked ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}