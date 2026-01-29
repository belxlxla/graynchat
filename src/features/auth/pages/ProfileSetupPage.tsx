import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, Image as ImageIcon, X, Eye, Trash2, User as UserIcon } from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(URL.createObjectURL(blob!)), 'image/jpeg'));
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.src = url;
  });

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [nickname, setNickname] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [avatarBlob, setAvatarBlob] = useState<Blob | null>(null);
  const [bgBlob, setBgBlob] = useState<Blob | null>(null);

  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [currentImageType, setCurrentImageType] = useState<'avatar' | 'background'>('avatar');
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'background') => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => { setTempImageSrc(reader.result as string); setCurrentImageType(type); setIsCropOpen(true); };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleCropSave = async () => {
    if (!tempImageSrc || !croppedAreaPixels) return;
    try {
      const croppedImageUrl = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      const res = await fetch(croppedImageUrl);
      const blob = await res.blob();
      if (currentImageType === 'avatar') { setAvatarUrl(croppedImageUrl); setAvatarBlob(blob); }
      else { setBackgroundUrl(croppedImageUrl); setBgBlob(blob); }
      setIsCropOpen(false);
    } catch (e) { toast.error('오류 발생'); }
  };

  const handleComplete = async () => {
    if (!user) return;
    const loadToast = toast.loading('최종 정보를 저장하고 있습니다...');
    try {
      let finalAv = avatarUrl;
      let finalBg = backgroundUrl;

      if (avatarBlob) {
        const { data } = await supabase.storage.from('profiles').upload(`${user.id}/avatar_${Date.now()}.jpg`, avatarBlob);
        if (data) finalAv = supabase.storage.from('profiles').getPublicUrl(data.path).data.publicUrl;
      }
      if (bgBlob) {
        const { data } = await supabase.storage.from('profiles').upload(`${user.id}/bg_${Date.now()}.jpg`, bgBlob);
        if (data) finalBg = supabase.storage.from('profiles').getPublicUrl(data.path).data.publicUrl;
      }

      await supabase.from('users').upsert({ id: user.id, name: nickname, status_message: statusMessage, avatar: finalAv, bg_image: finalBg, email: user.email });
      toast.success('그레인 가입을 환영합니다!', { id: loadToast });
      navigate('/main/friends');
    } catch (e) { toast.error('실패'); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-white relative overflow-hidden">
      {/* 상단 프로필 이미지 영역 */}
      <div className="relative w-full shrink-0">
        <div onClick={() => backgroundInputRef.current?.click()} className="relative w-full h-56 bg-[#2C2C2E] cursor-pointer overflow-hidden group">
          {backgroundUrl ? (
            <img src={backgroundUrl} className="w-full h-full object-cover opacity-70 group-hover:opacity-50 transition-opacity" alt="Bg" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#8E8E93] gap-2">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <span className="text-[13px] font-medium">배경 사진 추가</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all pointer-events-none">
            <Camera className="w-8 h-8 text-white drop-shadow-lg" />
          </div>
        </div>

        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
          <div onClick={() => avatarInputRef.current?.click()} className="relative cursor-pointer group">
            <div className="w-32 h-32 rounded-[42px] border-4 border-dark-bg bg-[#3A3A3C] overflow-hidden flex items-center justify-center shadow-2xl relative transition-transform active:scale-95">
              {avatarUrl ? (
                <img src={avatarUrl} className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" alt="Av" />
              ) : (
                <UserIcon className="w-12 h-12 opacity-30 text-[#8E8E93]" />
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-8 h-8 text-white drop-shadow-lg" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-brand-DEFAULT rounded-2xl flex items-center justify-center border-4 border-dark-bg shadow-lg">
              <Camera className="w-4 h-4 text-white" />
            </div>
          </div>
        </div>
      </div>

      <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange(e, 'avatar')} />
      <input type="file" ref={backgroundInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange(e, 'background')} />

      {/* 입력 폼 영역 */}
      <div className="flex-1 px-6 pt-20 pb-40 overflow-y-auto custom-scrollbar">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-black mb-2">프로필 설정</h2>
          <p className="text-[#8E8E93] text-sm leading-relaxed">다른 친구들에게 보여질<br/>멋진 프로필을 완성해 주세요.</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#636366] ml-1 uppercase tracking-wider">Nickname</label>
            <input 
              type="text" 
              value={nickname} 
              onChange={e => setNickname(e.target.value)} 
              placeholder="친구들이 부를 이름" 
              className="w-full bg-[#1C1C1E] rounded-2xl py-4 px-5 text-white focus:ring-2 focus:ring-brand-DEFAULT border border-[#2C2C2E] outline-none transition-all placeholder-[#48484A]" 
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#636366] ml-1 uppercase tracking-wider">Status Message</label>
            <input 
              type="text" 
              value={statusMessage} 
              onChange={e => setStatusMessage(e.target.value)} 
              placeholder="오늘의 기분이나 인사말" 
              className="w-full bg-[#1C1C1E] rounded-2xl py-4 px-5 text-white focus:ring-2 focus:ring-brand-DEFAULT border border-[#2C2C2E] outline-none transition-all placeholder-[#48484A]" 
            />
          </div>

          <button 
            onClick={() => setIsPreviewOpen(true)} 
            className="w-full py-4 rounded-2xl bg-[#2C2C2E] text-[#E5E5EA] font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-[#3A3A3C]"
          >
            <Eye className="w-5 h-5" /> 프로필 미리보기
          </button>
        </div>
      </div>

      {/* 하단 고정 버튼 영역 */}
      <div className="fixed bottom-0 left-0 w-full p-6 pb-safe-offset-4 bg-gradient-to-t from-dark-bg via-dark-bg to-transparent z-10">
        <button 
          onClick={handleComplete} 
          disabled={!nickname} 
          className={`w-full h-15 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-2xl transition-all active:scale-[0.98] ${
            nickname 
              ? 'bg-brand-DEFAULT text-white shadow-brand-DEFAULT/20' 
              : 'bg-[#2C2C2E] text-[#48484A] cursor-not-allowed'
          }`}
        >
          그레인 시작하기 {nickname && <Check className="w-6 h-6 ml-1" />}
        </button>
      </div>

      {/* 모달: 프로필 미리보기 */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#1C1C1E] w-full max-w-[340px] rounded-[40px] overflow-hidden shadow-2xl border border-[#2C2C2E]">
              <button onClick={() => setIsPreviewOpen(false)} className="absolute top-5 right-5 z-20 p-2 bg-black/40 rounded-full text-white backdrop-blur-md active:scale-90 transition-all"><X className="w-5 h-5" /></button>
              <div className="h-64 bg-[#2C2C2E] relative overflow-hidden">
                {backgroundUrl && <img src={backgroundUrl} className="w-full h-full object-cover" alt="Pre" />}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
              </div>
              <div className="px-6 pb-10 -mt-16 relative z-10 flex flex-col items-center">
                <div className="w-28 h-28 rounded-[38px] border-4 border-[#1C1C1E] bg-[#2C2C2E] overflow-hidden mb-5 shadow-2xl">
                  {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="Pre" /> : <div className="w-full h-full bg-[#3A3A3C] flex items-center justify-center"><UserIcon className="w-10 h-10 opacity-20" /></div>}
                </div>
                <h3 className="text-2xl font-black text-white mb-2">{nickname || '그레인 친구'}</h3>
                <p className="text-[#8E8E93] text-sm text-center leading-relaxed max-w-[80%] break-keep">
                  {statusMessage || '설정된 상태 메시지가 없습니다.'}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 모달: 이미지 편집 (Cropper) */}
      <AnimatePresence>
        {isCropOpen && tempImageSrc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 bg-black/80 backdrop-blur-md z-10 sticky top-0">
              <button onClick={() => setIsCropOpen(false)} className="p-2 -ml-2"><X className="w-7 h-7 text-white" /></button>
              <span className="font-bold text-lg text-white">이미지 편집</span>
              <button onClick={handleCropSave} className="px-5 py-2 bg-brand-DEFAULT rounded-full font-black text-sm text-white shadow-lg active:scale-95 transition-all">완료</button>
            </div>
            <div className="relative flex-1 bg-black">
              <Cropper 
                image={tempImageSrc} 
                crop={crop} 
                zoom={zoom} 
                aspect={currentImageType === 'avatar' ? 1 : 16/9} 
                onCropChange={setCrop} 
                onCropComplete={(_, p) => setCroppedAreaPixels(p)} 
                onZoomChange={setZoom} 
                cropShape={currentImageType === 'avatar' ? 'round' : 'rect'}
                showGrid={false}
              />
            </div>
            <div className="h-24 bg-black/80 backdrop-blur-md flex items-center justify-center px-10 gap-4">
               <span className="text-xs text-[#8E8E93]">ZOOM</span>
               <input 
                 type="range" 
                 min={1} 
                 max={3} 
                 step={0.1} 
                 value={zoom} 
                 onChange={(e) => setZoom(Number(e.target.value))} 
                 className="flex-1 accent-brand-DEFAULT"
               />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserPlaceholder() { 
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-[#2C2C2E]">
      <UserIcon className="w-10 h-10 opacity-20 text-[#8E8E93]" />
    </div>
  ); 
}