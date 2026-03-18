import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Palette, Image as ImageIcon, X, Check, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

// === [Signature Color (#FF203A) Based Palette] ===
const SOLID_COLORS = [
  '#1C1C1E', // [기본] 다크 스페이스
  '#0A1628', // [미드나잇] 깊은 네이비 (보색 계열)
  '#1A0F2E', // [딥 퍼플] 짙은 보라 (보색 인접)
  '#16213E', // [오션 블루] 차분한 청록
  '#0F1F3C', // [사파이어] 고급스러운 블루
  '#1B1226', // [다크 플럼] 어두운 자두색 (보색 인접)
  '#0D1B2A', // [오션 뎁스] 깊은 블루 블랙
  '#2A1428', // [버건디 나이트] 은은한 와인 (시그니처 계열)
  '#1E2833', // [슬레이트 블루] 세련된 청회색
  '#20152E', // [퍼플 쉐도우] 짙은 보라회색
  '#111827', // [그래파이트] 모던 블랙
  '#1F2937', // [차콜 블루] 차분한 청회색
  '#2D1B2E', // [플럼 그레이] 보라빛 회색
  '#1A2332', // [틸 블루] 차분한 청록
  '#231828', // [에스프레소] 짙은 갈색 보라
  '#0E2439', // [네이비 딥] 깊은 남색
];

export default function WallpaperSettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const targetChatId = searchParams.get('chatId'); 
  
  const [background, setBackground] = useState<string>('#1C1C1E'); 
  const [isColorModalOpen, setIsColorModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (targetChatId && user) {
      const fetchCurrentWallpaper = async () => {
        try {
          const { data, error } = await supabase
            .from('room_members')
            .select('wallpaper_url')
            .eq('room_id', targetChatId)
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (!error && data?.wallpaper_url) {
            setBackground(data.wallpaper_url);
          }
        } catch (e) {
          console.error('배경 불러오기 실패:', e);
        }
      };
      fetchCurrentWallpaper();
    }
  }, [targetChatId, user]);

  const handleAlbumSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setBackground(event.target.result as string); 
          toast.success('사진이 선택되었습니다. 적용 버튼을 눌러주세요.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleColorSelect = (color: string) => {
    setBackground(color);
  };

  const handleApply = async () => {
    if (!user) return;
    setIsSaving(true);
    const loadingToast = toast.loading('배경화면 저장 중...');

    try {
      const finalBackground = background;

      if (targetChatId) {
        const { error } = await supabase
          .from('room_members')
          .update({ wallpaper_url: finalBackground } as any)
          .eq('room_id', targetChatId)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('이 채팅방의 배경이 변경되었습니다.', { id: loadingToast });
      } else {
        const { error } = await supabase
          .from('room_members')
          .update({ wallpaper_url: finalBackground } as any)
          .eq('user_id', user.id);
            
        if (error) throw error;
        toast.success('모든 채팅방의 배경이 변경되었습니다.', { id: loadingToast });
      }
      
      navigate(-1);
    } catch (error: any) {
      console.error('wallpaper_url Error:', error);
      if (error.code === '42703') {
         toast.error('DB에 wallpaper_url 컬럼이 없습니다. 관리자에게 문의하세요.', { id: loadingToast });
      } else {
         toast.error('설정 저장에 실패했습니다.', { id: loadingToast });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const getBackgroundStyle = () => {
    if (background.startsWith('#') || background.startsWith('rgb')) {
      return { backgroundColor: background };
    }
    return { backgroundImage: `url(${background})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">
          {targetChatId ? '이 채팅방 배경화면' : '전체 배경화면'}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        <div className="w-full aspect-[4/5] max-h-[400px] relative overflow-hidden border-b border-[#2C2C2E]">
          <div className="absolute inset-0 transition-all duration-300" style={getBackgroundStyle()} />
          <div className="absolute inset-0 bg-black/10" /> 
          
          <div className="absolute inset-0 p-5 flex flex-col justify-end space-y-3">
            <div className="flex items-end gap-2 justify-start">
              <div className="w-8 h-8 rounded-xl bg-[#3A3A3C] shrink-0 overflow-hidden border border-white/10 flex items-center justify-center">
                 <User className="w-5 h-5 text-[#8E8E93] opacity-50" />
              </div>
              <div className="max-w-[70%] px-3.5 py-2 rounded-2xl rounded-tl-none text-[14px] leading-snug bg-[#2C2C2E] text-[#E5E5EA] shadow-sm border border-white/5">
                배경화면을 바꾸니까 분위기가 확 달라지네요!
              </div>
            </div>
            <div className="flex items-end gap-2 justify-end">
              <div className="max-w-[70%] px-3.5 py-2 rounded-2xl rounded-br-none text-[14px] leading-snug bg-[#FF203A] text-white shadow-sm">
                네, 마음에 드는 사진으로 설정해보세요.
              </div>
            </div>
            <div className="flex items-end gap-2 justify-end">
              <div className="max-w-[70%] px-3.5 py-2 rounded-2xl rounded-br-none text-[14px] leading-snug bg-[#FF203A] text-white shadow-sm">
                훨씬 보기 좋네요 👍
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-8">
          <div>
            <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2">배경 선택</h3>
            <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
              <button onClick={() => setIsColorModalOpen(true)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group border-b border-[#3A3A3C]">
                <div className="flex items-center gap-3">
                  <Palette className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">색상 배경</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group">
                <div className="flex items-center gap-3">
                  <ImageIcon className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[15px] text-white">앨범에서 사진 선택</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
              </button>
            </div>
          </div>

          <div>
            <button 
              onClick={handleApply}
              disabled={isSaving}
              className={`w-full h-14 rounded-2xl text-white font-bold text-[15px] flex items-center justify-center shadow-lg transition-all ${
                isSaving ? 'bg-[#3A3A3C] cursor-wait' : 'bg-brand-DEFAULT hover:bg-brand-hover'
              }`}
            >
              {isSaving ? '저장 중...' : (targetChatId ? '이 채팅방에 적용' : '모든 채팅방에 적용')}
            </button>
            <p className="text-[13px] text-[#8E8E93] mt-3 text-center leading-relaxed">
              {targetChatId ? '나에게만 적용되는 배경화면입니다.' : '설정 시 나의 모든 채팅방 배경이 변경됩니다.'}
            </p>
          </div>
        </div>
      </div>

      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAlbumSelect} />

      <AnimatePresence>
        {isColorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsColorModalOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-10 w-full max-w-[480px] bg-[#1C1C1E] rounded-t-3xl sm:rounded-2xl overflow-hidden p-6 pb-10 border border-[#2C2C2E]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-white font-bold text-lg">색상 선택</h3>
                <button onClick={() => setIsColorModalOpen(false)}><X className="w-6 h-6 text-[#8E8E93]" /></button>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {SOLID_COLORS.map((color, index) => (
                  <button 
                    key={`${color}-${index}`}
                    onClick={() => handleColorSelect(color)} 
                    className="aspect-square rounded-full border-2 border-[#3A3A3C] relative flex items-center justify-center transition-transform active:scale-95 hover:border-brand-DEFAULT/50" 
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
              <button onClick={() => setIsColorModalOpen(false)} className="w-full mt-8 py-3.5 bg-[#2C2C2E] rounded-xl text-white font-medium hover:bg-[#3A3A3C] transition-colors">
                선택 완료
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}