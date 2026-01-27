import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Moon, Sun, Type, Smartphone, Check } from 'lucide-react'; // ✨ motion 제거됨
import toast from 'react-hot-toast';

export default function DisplaySettingsPage() {
  const navigate = useNavigate();
  const [textSize, setTextSize] = useState(2); // 1~5 step
  const [isDarkMode, setIsDarkMode] = useState(true);

  const handleSave = () => {
    toast.success('화면 설정이 저장되었습니다.');
    navigate(-1);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      <header className="h-14 px-2 flex items-center justify-between bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold">화면</h1>
        <button onClick={handleSave} className="p-2 text-brand-DEFAULT font-bold text-sm">
          완료
        </button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 space-y-8">
        
        {/* 1. Theme Mode */}
        <section>
          <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-3">화면 모드</h3>
          <div className="grid grid-cols-2 gap-4">
            <button 
              onClick={() => setIsDarkMode(false)}
              className={`relative p-4 rounded-2xl border-2 transition-all ${!isDarkMode ? 'border-brand-DEFAULT bg-[#2C2C2E]' : 'border-[#3A3A3C] bg-[#2C2C2E]'}`}
            >
              <div className="h-24 bg-gray-100 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                <div className="w-3/4 h-full bg-white shadow-sm p-2">
                  <div className="w-full h-2 bg-gray-200 rounded mb-2"/>
                  <div className="w-2/3 h-2 bg-gray-200 rounded"/>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Sun className="w-4 h-4 text-[#8E8E93]" />
                <span className="text-sm font-medium text-white">라이트 모드</span>
              </div>
              {!isDarkMode && <div className="absolute top-3 right-3 w-5 h-5 bg-brand-DEFAULT rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
            </button>

            <button 
              onClick={() => setIsDarkMode(true)}
              className={`relative p-4 rounded-2xl border-2 transition-all ${isDarkMode ? 'border-brand-DEFAULT bg-[#2C2C2E]' : 'border-[#3A3A3C] bg-[#2C2C2E]'}`}
            >
              <div className="h-24 bg-[#1C1C1E] rounded-xl mb-3 flex items-center justify-center overflow-hidden">
                <div className="w-3/4 h-full bg-[#2C2C2E] shadow-sm p-2 border border-[#3A3A3C]">
                  <div className="w-full h-2 bg-[#48484A] rounded mb-2"/>
                  <div className="w-2/3 h-2 bg-[#48484A] rounded"/>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Moon className="w-4 h-4 text-[#8E8E93]" />
                <span className="text-sm font-medium text-white">다크 모드</span>
              </div>
              {isDarkMode && <div className="absolute top-3 right-3 w-5 h-5 bg-brand-DEFAULT rounded-full flex items-center justify-center"><Check className="w-3 h-3 text-white" /></div>}
            </button>
          </div>
        </section>

        {/* 2. Text Size */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-xs font-bold text-[#8E8E93]">글자 크기</h3>
            <span className="text-xs text-brand-DEFAULT font-bold">{textSize * 20}%</span>
          </div>
          <div className="bg-[#2C2C2E] rounded-2xl p-6 border border-[#3A3A3C]">
            <div className="flex items-center justify-between mb-6">
              <Type className="w-4 h-4 text-[#8E8E93]" />
              <Type className="w-8 h-8 text-white" />
            </div>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="1" 
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              className="w-full accent-brand-DEFAULT h-1.5 bg-[#48484A] rounded-lg appearance-none cursor-pointer"
            />
            
            {/* Preview Bubble */}
            <div className="mt-6 flex justify-center">
              <div className="bg-brand-DEFAULT text-white px-4 py-3 rounded-2xl rounded-tr-sm">
                <p style={{ fontSize: `${13 + textSize}px` }} className="leading-snug transition-all">
                  안녕하세요! 글자 크기 미리보기입니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Etc */}
        <section>
          <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-3">기타</h3>
          <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
            <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] transition-colors text-left">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-[#8E8E93]" />
                <span className="text-[15px] text-white">화면 자동 꺼짐 시간</span>
              </div>
              <span className="text-[13px] text-[#8E8E93]">1분</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}