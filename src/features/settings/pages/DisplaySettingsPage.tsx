import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Type, Image as ImageIcon, Smartphone, Check, X } from 'lucide-react';
import toast from 'react-hot-toast';

export default function DisplaySettingsPage() {
  const navigate = useNavigate();

  // === States ===
  const [orientation, setOrientation] = useState<'auto' | 'portrait' | 'landscape'>('auto');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // === Helper ===
  const getOrientationLabel = (val: string) => {
    switch(val) {
      case 'auto': return '자동 회전';
      case 'portrait': return '세로 고정';
      case 'landscape': return '가로 고정';
      default: return '자동 회전';
    }
  };

  // === Handler ===
  const handleOrientationSelect = (val: 'auto' | 'portrait' | 'landscape') => {
    setOrientation(val);
    setIsModalOpen(false);
    toast.success(`화면 방향이 '${getOrientationLabel(val)}'으로 설정되었습니다.`);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* Header */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">화면</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pt-4">
        <div className="px-5 space-y-6">
          <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
            
            {/* 1. 글자크기/글씨체 */}
            <ListItem 
              icon={<Type className="w-5 h-5 text-[#8E8E93]" />}
              label="글자크기/글씨체"
              onClick={() => navigate('/settings/display/font')}
            />

            <div className="h-[1px] bg-[#3A3A3C] mx-4" />

            {/* 2. 배경화면 (연결됨) */}
            <ListItem 
              icon={<ImageIcon className="w-5 h-5 text-[#8E8E93]" />}
              label="배경화면"
              onClick={() => navigate('/settings/display/wallpaper')} // ✨ 연결됨
            />

            <div className="h-[1px] bg-[#3A3A3C] mx-4" />

            {/* 3. 화면 방향 */}
            <ListItem 
              icon={<Smartphone className="w-5 h-5 text-[#8E8E93]" />}
              label="화면 방향"
              value={getOrientationLabel(orientation)}
              onClick={() => setIsModalOpen(true)}
            />

          </div>
        </div>
      </div>

      {/* Orientation Selection Modal */}
      <OrientationModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        current={orientation}
        onSelect={handleOrientationSelect}
      />
    </div>
  );
}

// === Sub Components ===

function ListItem({ icon, label, value, onClick }: { icon: React.ReactNode, label: string, value?: string, onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-[15px] text-white">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-[13px] text-[#8E8E93]">{value}</span>}
        <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
      </div>
    </button>
  );
}

function OrientationModal({ isOpen, onClose, current, onSelect }: { isOpen: boolean, onClose: () => void, current: string, onSelect: (val: any) => void }) {
  if (!isOpen) return null;
  const options = [
    { id: 'auto', label: '자동 회전' },
    { id: 'portrait', label: '세로 고정' },
    { id: 'landscape', label: '가로 고정' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 sm:items-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} 
        transition={{ type: "spring", damping: 25, stiffness: 300 }} 
        className="relative z-10 w-full max-w-[480px] bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl overflow-hidden p-6 pb-10 border border-[#2C2C2E]"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white font-bold text-lg">화면 방향 선택</h3>
          <button onClick={onClose}><X className="w-6 h-6 text-[#8E8E93]" /></button>
        </div>
        <div className="space-y-2">
          {options.map((opt) => (
            <button 
              key={opt.id} 
              onClick={() => onSelect(opt.id)} 
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-[#2C2C2E] transition-colors"
            >
              <span className={`text-[15px] ${current === opt.id ? 'text-brand-DEFAULT font-bold' : 'text-white'}`}>
                {opt.label}
              </span>
              {current === opt.id && <Check className="w-5 h-5 text-brand-DEFAULT" />}
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}