import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Bell, MessageSquare, Volume2, Moon, Sparkles } from 'lucide-react';

export default function NotificationSettingsPage() {
  const navigate = useNavigate();

  // Settings State
  const [settings, setSettings] = useState({
    all: true,
    preview: true,
    sound: true,
    vibrate: true,
    keywords: false,
    marketing: false,
  });

  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">알림 설정</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 space-y-8">
        
        {/* Main Toggle */}
        <div className="bg-[#2C2C2E] rounded-2xl p-5 flex items-center justify-between border border-[#3A3A3C]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-DEFAULT/20 flex items-center justify-center text-brand-DEFAULT">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-white">전체 알림 받기</h3>
              <p className="text-xs text-[#8E8E93] mt-0.5">모든 푸시 알림을 켜고 끕니다.</p>
            </div>
          </div>
          <Switch checked={settings.all} onChange={() => toggle('all')} />
        </div>

        {/* Detailed Settings */}
        <Section title="메시지 알림">
          <ToggleItem 
            icon={<MessageSquare className="w-5 h-5" />} 
            label="메시지 미리보기" 
            checked={settings.preview} 
            onChange={() => toggle('preview')} 
          />
          <ToggleItem 
            icon={<Sparkles className="w-5 h-5" />} 
            label="키워드 알림" 
            checked={settings.keywords} 
            onChange={() => toggle('keywords')} 
          />
        </Section>

        <Section title="소리 및 진동">
          <ToggleItem 
            icon={<Volume2 className="w-5 h-5" />} 
            label="알림음" 
            checked={settings.sound} 
            onChange={() => toggle('sound')} 
          />
          <ToggleItem 
            icon={<SmartphoneIcon />} 
            label="진동" 
            checked={settings.vibrate} 
            onChange={() => toggle('vibrate')} 
          />
        </Section>

        <Section title="기타">
          <ToggleItem 
            icon={<Moon className="w-5 h-5" />} 
            label="방해금지 시간대 설정" 
            checked={false} 
            onChange={() => {}} 
            disabled 
          />
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

// ✨ 수정됨: label 사용 에러 방지 (사실 여기선 label을 쓰고 있어서 에러가 안 나야 정상이지만, 에러 로그에 따라 확인)
function ToggleItem({ 
  icon, label, checked, onChange, disabled 
}: { 
  icon: React.ReactNode, label: string, checked: boolean, onChange: () => void, disabled?: boolean 
}) {
  return (
    <div className={`flex items-center justify-between px-5 py-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="text-[#8E8E93]">{icon}</div>
        <span className="text-[15px] text-white">{label}</span> {/* ✨ label 사용됨 */}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Switch({ checked, onChange, disabled }: { checked: boolean, onChange: () => void, disabled?: boolean }) {
  return (
    <button 
      onClick={onChange}
      disabled={disabled}
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

// Smartphone Icon Helper
const SmartphoneIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="20" height="20" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
    <path d="M12 18h.01" />
  </svg>
);