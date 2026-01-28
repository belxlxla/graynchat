import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Moon, Sun, Type, Lock, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DisplaySettingsPage() {
  const navigate = useNavigate();

  // --- [States] ---
  const [textSize, setTextSize] = useState(2); // 1~5 단계
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [autoLockTime, setAutoLockTime] = useState('1분');

  // --- [Effect] 실제 시스템 반영 로직 ---
  useEffect(() => {
    // 1. 글자 크기 실제 Root HTML에 적용 (단위: px)
    const baseFontSize = 14 + (textSize * 1);
    document.documentElement.style.fontSize = `${baseFontSize}px`;

    // 2. 배경색 바디에 직접 적용 (빈 화면 방지 및 부드러운 전환)
    if (!isDarkMode) {
      document.body.style.backgroundColor = '#F2F2F7'; // 은은한 화이트톤 (iOS 스타일 그레이시 화이트)
    } else {
      document.body.style.backgroundColor = '#000000'; // 다크 (Grayn 기본색)
    }
  }, [textSize, isDarkMode]);

  const handleSave = () => {
    // 설정 값 로컬 저장
    localStorage.setItem('grayn_theme', isDarkMode ? 'dark' : 'light');
    localStorage.setItem('grayn_text_size', String(textSize));
    localStorage.setItem('grayn_auto_lock', autoLockTime);

    toast.success('화면 설정이 저장되었습니다.');
    navigate(-1);
  };

  // --- [Styles] 테마별 동적 클래스 매핑 ---
  const themeStyles = {
    bg: isDarkMode ? 'bg-dark-bg' : 'bg-[#F2F2F7]',
    header: isDarkMode ? 'bg-[#1C1C1E] border-[#2C2C2E]' : 'bg-white border-[#E5E5EA]',
    card: isDarkMode ? 'bg-[#2C2C2E] border-[#3A3A3C]' : 'bg-white border-[#E5E5EA]',
    textPrimary: isDarkMode ? 'text-white' : 'text-[#1C1C1E]',
    textSecondary: isDarkMode ? 'text-[#8E8E93]' : 'text-[#8A8A8E]',
    btnText: isDarkMode ? 'text-white' : 'text-[#1C1C1E]',
    itemHover: isDarkMode ? 'hover:bg-[#3A3A3C]' : 'hover:bg-[#F9F9F9]'
  };

  return (
    <div className={`flex flex-col h-[100dvh] ${themeStyles.bg} ${themeStyles.textPrimary} transition-colors duration-300 overflow-hidden`}>
      
      {/* Header */}
      <header className={`h-14 px-2 flex items-center justify-between ${themeStyles.header} border-b shrink-0 z-10`}>
        <button onClick={() => navigate(-1)} className={`p-2 ${themeStyles.btnText} hover:text-brand-DEFAULT transition-colors`}>
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold">화면 및 텍스트</h1>
        <button onClick={handleSave} className="p-2 text-brand-DEFAULT font-bold text-sm">
          완료
        </button>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 space-y-8">
        
        {/* 1. Theme Mode Selection (진짜 화이트/다크 전환) */}
        <section>
          <h3 className={`text-xs font-bold ${themeStyles.textSecondary} ml-1 mb-3 uppercase tracking-wider`}>화면 모드</h3>
          <div className="grid grid-cols-2 gap-4">
            {/* 라이트 모드 버튼 */}
            <button 
              onClick={() => setIsDarkMode(false)}
              className={`relative p-4 rounded-2xl border-2 transition-all ${!isDarkMode ? 'border-brand-DEFAULT' : 'border-transparent'} ${themeStyles.card}`}
            >
              <div className="h-24 bg-[#F9F9F9] rounded-xl mb-3 flex items-center justify-center border border-[#E5E5EA] overflow-hidden">
                <div className="w-3/4 h-14 bg-white shadow-sm rounded-lg p-2">
                  <div className="w-full h-1.5 bg-[#E5E5EA] rounded-full mb-2"/>
                  <div className="w-2/3 h-1.5 bg-[#E5E5EA] rounded-full"/>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Sun className={`w-4 h-4 ${!isDarkMode ? 'text-brand-DEFAULT' : themeStyles.textSecondary}`} />
                <span className={`text-sm font-bold ${themeStyles.textPrimary}`}>라이트 모드</span>
              </div>
              {!isDarkMode && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-brand-DEFAULT rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>

            {/* 다크 모드 버튼 */}
            <button 
              onClick={() => setIsDarkMode(true)}
              className={`relative p-4 rounded-2xl border-2 transition-all ${isDarkMode ? 'border-brand-DEFAULT' : 'border-transparent'} ${themeStyles.card}`}
            >
              <div className="h-24 bg-[#1C1C1E] rounded-xl mb-3 flex items-center justify-center border border-[#2C2C2E] overflow-hidden">
                <div className="w-3/4 h-14 bg-[#2C2C2E] shadow-sm rounded-lg p-2">
                  <div className="w-full h-1.5 bg-[#3A3A3C] rounded-full mb-2"/>
                  <div className="w-2/3 h-1.5 bg-[#3A3A3C] rounded-full"/>
                </div>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Moon className={`w-4 h-4 ${isDarkMode ? 'text-brand-DEFAULT' : themeStyles.textSecondary}`} />
                <span className={`text-sm font-bold ${themeStyles.textPrimary}`}>다크 모드</span>
              </div>
              {isDarkMode && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-brand-DEFAULT rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
            </button>
          </div>
        </section>

        {/* 2. Text Size Slider (실시간 시스템 폰트 크기 변경) */}
        <section>
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className={`text-xs font-bold ${themeStyles.textSecondary} uppercase tracking-wider`}>글자 크기</h3>
            <span className="text-xs text-brand-DEFAULT font-bold">{100 + (textSize - 2) * 10}%</span>
          </div>
          <div className={`${themeStyles.card} rounded-3xl p-6 border shadow-sm`}>
            <div className="flex items-center justify-between mb-8 px-1">
              <Type className={`w-4 h-4 ${themeStyles.textSecondary}`} />
              <div className={`h-[1px] flex-1 mx-4 ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`} />
              <Type className={`w-8 h-8 ${themeStyles.textPrimary}`} />
            </div>
            <input 
              type="range" 
              min="1" 
              max="5" 
              step="1" 
              value={textSize}
              onChange={(e) => setTextSize(Number(e.target.value))}
              className="w-full accent-brand-DEFAULT h-1.5 rounded-lg appearance-none cursor-pointer"
              style={{ background: isDarkMode ? '#48484A' : '#E5E5EA' }}
            />
            
            {/* Preview Bubble */}
            <div className="mt-8 flex justify-center">
              <div className="bg-brand-DEFAULT text-white px-5 py-3 rounded-[20px] rounded-br-none shadow-lg">
                <p style={{ fontSize: `${13 + (textSize * 1)}px` }} className="leading-snug transition-all duration-200">
                  Grayn에서 대화가 더욱 선명해집니다.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Auto Lock Setting (자동 꺼짐 대신 자동 잠금으로 수정) */}
        <section>
          <h3 className={`text-xs font-bold ${themeStyles.textSecondary} ml-1 mb-3 uppercase tracking-wider`}>보안 및 잠금</h3>
          <div className={`${themeStyles.card} rounded-3xl overflow-hidden border shadow-sm`}>
            <button 
              onClick={() => {
                const times = ['즉시', '1분', '2분', '5분', '안 함'];
                const nextIdx = (times.indexOf(autoLockTime) + 1) % times.length;
                setAutoLockTime(times[nextIdx]);
              }}
              className={`w-full flex items-center justify-between px-6 py-5 ${themeStyles.itemHover} transition-colors text-left`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-white/5' : 'bg-black/5'}`}>
                  <Lock className="w-5 h-5 text-brand-DEFAULT" />
                </div>
                <div>
                  <p className={`text-[15px] font-bold ${themeStyles.textPrimary}`}>자동 잠금 시간</p>
                  <p className={`text-xs ${themeStyles.textSecondary}`}>앱을 사용하지 않을 때 잠금 적용</p>
                </div>
              </div>
              <span className="text-[15px] text-brand-DEFAULT font-bold">{autoLockTime}</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}