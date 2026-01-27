import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function FontSettingsPage() {
  const navigate = useNavigate();

  // === States ===
  const [activeTab, setActiveTab] = useState<'size' | 'font'>('size');
  const [useOSSetting, setUseOSSetting] = useState(false);
  const [sliderValue, setSliderValue] = useState(3); // 0 ~ 6 (Total 7 steps, 3 is default/center)

  // === Helpers ===
  // 0~6 단계별 폰트 사이즈 (px 단위, 예시)
  const getFontSize = (step: number) => {
    const sizes = [13, 14, 15, 16, 18, 20, 24]; 
    return sizes[step];
  };

  // === Handlers ===
  const handleTabChange = (tab: 'size' | 'font') => {
    if (tab === 'font') {
      toast('글씨체 변경 기능은 준비 중입니다.');
      return;
    }
    setActiveTab(tab);
  };

  const toggleOSSetting = () => {
    setUseOSSetting(!useOSSetting);
    if (!useOSSetting) {
      toast.success('OS 설정값을 따릅니다.');
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* Header */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">글자크기/글씨체</h1>
      </header>

      {/* Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* 1. Preview Area (Chat Bubble) */}
        <div className="flex-1 bg-[#151515] flex flex-col justify-center px-5 relative overflow-hidden">
          <div className="space-y-4 max-w-md mx-auto w-full">
            {/* Other's Message */}
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#3A3A3C] shrink-0" />
              <div 
                className="px-4 py-2.5 bg-[#2C2C2E] rounded-2xl rounded-tl-none text-white max-w-[80%]"
                style={{ fontSize: `${getFontSize(sliderValue)}px`, lineHeight: 1.4 }}
              >
                안녕하세요! 지금 글자 크기 설정 중이신가요?
              </div>
            </div>
            {/* My Message */}
            <div className="flex items-end justify-end gap-2">
              <div 
                className="px-4 py-2.5 bg-brand-DEFAULT rounded-2xl rounded-br-none text-white max-w-[80%]"
                style={{ fontSize: `${getFontSize(sliderValue)}px`, lineHeight: 1.4 }}
              >
                네, 이렇게 미리보기로 확인하니까 편하네요!
              </div>
            </div>
            {/* Timestamp Preview */}
            <div className="text-center">
              <span className="text-[#636366]" style={{ fontSize: `${Math.max(10, getFontSize(sliderValue) - 4)}px` }}>
                오후 12:30
              </span>
            </div>
          </div>
        </div>

        {/* 2. Controls Area */}
        <div className="bg-[#1C1C1E] rounded-t-3xl border-t border-[#2C2C2E] pb-safe">
          
          {/* Tabs */}
          <div className="flex border-b border-[#2C2C2E]">
            <button 
              onClick={() => handleTabChange('size')}
              className={`flex-1 py-4 text-sm font-bold relative transition-colors ${activeTab === 'size' ? 'text-white' : 'text-[#636366]'}`}
            >
              크기
              {activeTab === 'size' && <motion.div layoutId="tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-white mx-10" />}
            </button>
            <button 
              onClick={() => handleTabChange('font')}
              className={`flex-1 py-4 text-sm font-bold relative transition-colors ${activeTab === 'font' ? 'text-white' : 'text-[#636366]'}`}
            >
              글씨체
            </button>
          </div>

          {/* Size Tab Content */}
          {activeTab === 'size' && (
            <div className="p-6 space-y-8">
              
              {/* OS Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-medium text-white">OS 설정</span>
                  <Toggle isOn={useOSSetting} onToggle={toggleOSSetting} />
                </div>
                <p className="text-[12px] text-[#8E8E93] leading-relaxed">
                  설정 {'>'} 디스플레이 및 밝기 {'>'} 텍스트 크기 에서 OS 설정을 직접 변경할 수 있습니다.
                </p>
              </div>

              {/* Slider Section */}
              <div className={`transition-opacity duration-300 ${useOSSetting ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                <div className="flex justify-between items-end mb-4 px-1">
                  <span className="text-xs text-[#8E8E93]">작게</span>
                  <span className="text-xs text-[#8E8E93]">크게</span>
                </div>
                
                {/* Custom Range Slider */}
                <div className="relative h-10 flex items-center">
                  {/* Track Lines */}
                  <div className="absolute w-full h-1 bg-[#3A3A3C] rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-DEFAULT transition-all duration-200" 
                      style={{ width: `${(sliderValue / 6) * 100}%` }}
                    />
                  </div>
                  
                  {/* Step Dots (Visual) */}
                  <div className="absolute w-full flex justify-between px-0.5 pointer-events-none">
                    {[0, 1, 2, 3, 4, 5, 6].map((step) => (
                      <div 
                        key={step} 
                        className={`w-1 h-1 rounded-full transition-colors ${step <= sliderValue ? 'bg-brand-DEFAULT' : 'bg-[#636366]'}`} 
                      />
                    ))}
                  </div>

                  {/* Native Input (Hidden but Functional) */}
                  <input
                    type="range"
                    min="0"
                    max="6"
                    step="1"
                    value={sliderValue}
                    onChange={(e) => setSliderValue(Number(e.target.value))}
                    className="absolute w-full h-full opacity-0 cursor-pointer z-10"
                  />

                  {/* Thumb (Visual) */}
                  <motion.div 
                    className="absolute w-6 h-6 bg-white rounded-full shadow-lg border border-[#8E8E93] pointer-events-none"
                    animate={{ left: `calc(${(sliderValue / 6) * 100}% - 12px)` }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </div>
                
                {/* Current Value Label */}
                <div className="text-center mt-2">
                  <span className="text-xs text-brand-DEFAULT font-bold">
                    {sliderValue === 3 ? '보통' : sliderValue < 3 ? '작게' : '크게'} ({sliderValue + 1}/7)
                  </span>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// === Sub Components ===
function Toggle({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  return (
    <div 
      onClick={onToggle}
      className={`w-[52px] h-[32px] shrink-0 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
        isOn ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
      }`}
    >
      <motion.div
        className="w-6 h-6 bg-white rounded-full shadow-md"
        animate={{ x: isOn ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </div>
  );
}