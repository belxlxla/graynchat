import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Palette, Image as ImageIcon, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

// === [Mock Colors] ===
const SOLID_COLORS = [
  '#1C1C1E', // Default Dark
  '#2C2C2E', // Lighter Gray
  '#000000', // Pitch Black
  '#1E3A8A', // Dark Blue
  '#3730A3', // Indigo
  '#4C1D95', // Violet
  '#831843', // Pink
  '#881337', // Rose
  '#14532D', // Green
  '#713F12', // Brown
  '#7C2D12', // Orange
  '#451A03', // Sepia
];

export default function WallpaperSettingsPage() {
  const navigate = useNavigate();
  
  // States
  const [background, setBackground] = useState<string>('#1C1C1E'); 
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === Handlers ===

  const handleAlbumSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setBackground(event.target.result as string);
          toast.success('사진이 배경으로 설정되었습니다.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorSelect = (color: string) => {
    setBackground(color);
  };

  const handleApplyAll = () => {
    toast.success('모든 채팅방에 배경화면이 적용되었습니다.');
    navigate(-1);
  };

  const getBackgroundStyle = () => {
    if (background.startsWith('#')) {
      return { backgroundColor: background };
    }
    return { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* Header */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">배경화면</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        {/* 1. Preview Area */}
        <div className="w-full aspect-[4/5] max-h-[400px] relative overflow-hidden border-b border-[#2C2C2E]">
          <div 
            className="absolute inset-0 transition-all duration-300"
            style={getBackgroundStyle()}
          />
          <div className="absolute inset-0 bg-black/10" /> 
          
          {/* Mock Chat Bubbles */}
          <div className="absolute inset-0 p-5 flex flex-col justify-end space-y-3">
            
            {/* Other (상대방) */}
            <div className="flex items-end gap-2 justify-start">
              <div className="w-8 h-8 rounded-xl bg-[#3A3A3C] shrink-0 overflow-hidden border border-white/10">
                 <img src="https://i.pravatar.cc/150?u=2" alt="Other" className="w-full h-full object-cover" />
              </div>
              <div className="max-w-[70%] px-3.5 py-2 rounded-2xl rounded-tl-none text-[14px] leading-snug bg-[#2C2C2E] text-[#E5E5EA] shadow-sm border border-white/5">
                배경화면을 바꾸니까 분위기가 확 달라지네요!
              </div>
            </div>

            {/* Me (나) - 수정됨: bg-[#FF203A] (가시성 확보) */}
            <div className="flex items-end gap-2 justify-end">
              <div className="max-w-[70%] px-3.5 py-2 rounded-2xl rounded-br-none text-[14px] leading-snug bg-[#FF203A] text-white shadow-sm">
                네, 마음에 드는 사진으로 설정해보세요.
              </div>
            </div>
            
            {/* Me (나) - 연속 메시지 */}
            <div className="flex items-end gap-2 justify-end">
              <div className="max-w-[70%] px-3.5 py-2 rounded-2xl rounded-br-none text-[14px] leading-snug bg-[#FF203A] text-white shadow-sm">
                훨씬 보기 좋네요 👍
              </div>
            </div>

          </div>
        </div>

        {/* 2. Controls */}
        <div className="p-5 space-y-8">
          
          {/* Section: 배경 선택 */}
          <div>
            <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2">배경 선택</h3>
            <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
              
              <button 
                onClick={() => setIsColorModalOpen(true)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group border-b border-[#3A3A3C]"
              >
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">색상 배경</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
              </button>

              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">앨범에서 사진 선택</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
              </button>
            </div>
          </div>

          {/* Section: Apply All (Left Aligned) */}
          <div>
            {/* ✨ 수정됨: flex, justify-start, text-left, pl-5 */}
            <button 
              onClick={handleApplyAll}
              className="w-full h-14 bg-brand-DEFAULT rounded-2xl text-white font-bold text-[15px] flex items-center justify-start pl-5 hover:bg-brand-hover transition-colors shadow-lg"
            >
              모든 채팅방에 적용
            </button>
            <p className="text-[13px] text-[#8E8E93] mt-3 pl-2 text-left leading-relaxed">
              별도로 배경화면을 설정한 채팅방도<br/>
              위에서 선택한 배경화면으로 일괄 변경됩니다.
            </p>
          </div>

        </div>
      </div>

      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={handleAlbumSelect} 
      />

      {/* Color Picker Modal */}
      <AnimatePresence>
        {isColorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
              onClick={() => setIsColorModalOpen(false)} 
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} 
              transition={{ type: "spring", damping: 25, stiffness: 300 }} 
              className="relative z-10 w-full max-w-[480px] bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl overflow-hidden p-6 pb-10 border border-[#2C2C2E]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold text-lg">색상 선택</h3>
                <button onClick={() => setIsColorModalOpen(false)}><X className="w-6 h-6 text-[#8E8E93]" /></button>
              </div>
              
              <div className="grid grid-cols-4 gap-4">
                {SOLID_COLORS.map((color) => (
                  <button 
                    key={color} 
                    onClick={() => handleColorSelect(color)}
                    className="aspect-square rounded-full border-2 border-[#3A3A3C] relative flex items-center justify-center transition-transform active:scale-95"
                    style={{ backgroundColor: color }}
                  >
                    {background === color && (
                      <div className="w-full h-full rounded-full bg-black/20 flex items-center justify-center">
                        <Check className="w-6 h-6 text-white drop-shadow-md" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => setIsColorModalOpen(false)}
                className="w-full mt-8 py-3.5 bg-[#2C2C2E] rounded-xl text-white font-medium hover:bg-[#3A3A3C] transition-colors"
              >
                완료
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}