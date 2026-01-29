import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, Image as ImageIcon, X, Eye, User as UserIcon } from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface ProfileSetupPageProps {
  onComplete?: () => void;
}

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = imageSrc;
  });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(URL.createObjectURL(blob!)), 'image/jpeg'));
}

export default function ProfileSetupPage({ onComplete }: ProfileSetupPageProps) {
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
      const reader = new FileReader();
      reader.onload = () => {
        setTempImageSrc(reader.result as string);
        setCurrentImageType(type);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setIsCropOpen(true);
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleCropSave = async () => {
    if (!tempImageSrc || !croppedAreaPixels) return;
    try {
      const croppedImageUrl = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      const res = await fetch(croppedImageUrl);
      const blob = await res.blob();
      if (currentImageType === 'avatar') {
        setAvatarUrl(croppedImageUrl);
        setAvatarBlob(blob);
      } else {
        setBackgroundUrl(croppedImageUrl);
        setBgBlob(blob);
      }
      setIsCropOpen(false);
    } catch {
      toast.error('이미지 편집 중 오류가 발생했습니다.');
    }
  };

  const handleComplete = async () => {
    if (!user) return;
    const loadToast = toast.loading('프로필 정보를 저장하고 있습니다...');
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

      const { error } = await supabase.from('users').upsert({
        id: user.id,
        name: nickname,
        status_message: statusMessage,
        avatar: finalAv,
        bg_image: finalBg,
        email: user.email
      });

      if (error) throw error;

      toast.success('그레인 가입을 환영합니다!', { id: loadToast });
      if (onComplete) onComplete(); else navigate('/main/friends');
    } catch {
      toast.error('저장에 실패했습니다.', { id: loadToast });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-white overflow-hidden">
      {/* 상단 이미지 영역 */}
      <div className="relative w-full shrink-0">
        <div onClick={() => backgroundInputRef.current?.click()} className="h-56 bg-[#2C2C2E] cursor-pointer overflow-hidden group">
          {backgroundUrl ? (
            <img src={backgroundUrl} className="w-full h-full object-cover opacity-70" alt="Bg" />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-[#8E8E93] gap-2">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <span className="text-[13px]">배경 추가</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-8 h-8" /></div>
        </div>

        <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
          <div onClick={() => avatarInputRef.current?.click()} className="w-32 h-32 rounded-[42px] border-4 border-dark-bg bg-[#3A3A3C] overflow-hidden flex items-center justify-center shadow-2xl relative">
            {avatarUrl ? (
              <img src={avatarUrl} className="w-full h-full object-cover" alt="Av" />
            ) : (
              <UserIcon className="w-12 h-12 opacity-30 text-[#8E8E93]" />
            )}
            <div className="absolute inset-0 bg-black/20 opacity-0 hover:opacity-100 flex items-center justify-center transition-opacity"><Camera className="w-8 h-8" /></div>
          </div>
          <div className="absolute bottom-0 right-0 w-8 h-8 bg-brand-DEFAULT rounded-full flex items-center justify-center border-2 border-dark-bg"><Camera className="w-4 h-4 text-white" /></div>
        </div>
      </div>

      <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={e => onFileChange(e, 'avatar')} />
      <input type="file" ref={backgroundInputRef} className="hidden" accept="image/*" onChange={e => onFileChange(e, 'background')} />

      {/* 입력 폼 영역 */}
      <div className="flex-1 px-6 pt-20 pb-40 overflow-y-auto custom-scrollbar">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-black mb-2">프로필 설정</h2>
          <p className="text-[#8E8E93] text-sm leading-relaxed">멋진 프로필을 완성해 주세요.</p>
        </div>
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#636366] ml-1">NICKNAME</label>
            <input type="text" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="닉네임" className="w-full bg-[#1C1C1E] rounded-2xl py-4 px-5 text-white focus:ring-2 focus:ring-brand-DEFAULT border border-[#2C2C2E] outline-none transition-all" />
          </div>
          <div className="space-y-2">
            <label className="text-[13px] font-bold text-[#636366] ml-1">STATUS MESSAGE</label>
            <input type="text" value={statusMessage} onChange={e => setStatusMessage(e.target.value)} placeholder="상태 메시지" className="w-full bg-[#1C1C1E] rounded-2xl py-4 px-5 text-white focus:ring-2 focus:ring-brand-DEFAULT border border-[#2C2C2E] outline-none transition-all" />
          </div>
          <button onClick={() => setIsPreviewOpen(true)} className="w-full py-4 rounded-2xl bg-[#2C2C2E] text-[#E5E5EA] font-bold flex items-center justify-center gap-2 active:scale-95 transition-all"><Eye className="w-5 h-5" /> 미리보기</button>
        </div>
      </div>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-dark-bg via-dark-bg to-transparent z-10 pb-safe">
        <button 
          onClick={handleComplete} 
          disabled={!nickname} 
          className={`w-full h-15 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-2xl transition-all ${nickname ? 'bg-brand-DEFAULT text-white active:scale-95' : 'bg-[#2C2C2E] text-[#48484A]'}`}
        >
          그레인 시작하기 {nickname && <Check className="w-6 h-6 ml-1" />}
        </button>
      </div>

      {/* 모달: 미리보기 */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90" onClick={() => setIsPreviewOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#1C1C1E] w-full max-w-[340px] rounded-[40px] overflow-hidden border border-[#2C2C2E]">
              <button onClick={() => setIsPreviewOpen(false)} className="absolute top-5 right-5 z-20 p-2 bg-black/40 rounded-full text-white"><X className="w-5 h-5" /></button>
              <div className="h-64 bg-[#2C2C2E] relative overflow-hidden">
                {backgroundUrl && <img src={backgroundUrl} className="w-full h-full object-cover" alt="Pre" />}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
              </div>
              <div className="px-6 pb-10 -mt-16 relative z-10 flex flex-col items-center text-center">
                <div className="w-28 h-28 rounded-[38px] border-4 border-[#1C1C1E] bg-[#2C2C2E] overflow-hidden mb-5">
                  {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="Pre" /> : <div className="w-full h-full bg-[#3A3A3C] flex items-center justify-center"><UserIcon className="w-10 h-10 opacity-20" /></div>}
                </div>
                <h3 className="text-2xl font-black text-white mb-2">{nickname || '닉네임'}</h3>
                <p className="text-[#8E8E93] text-sm leading-relaxed">{statusMessage || '상태 메시지가 없습니다.'}</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 모달: 편집 */}
      <AnimatePresence>
        {isCropOpen && tempImageSrc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 bg-black/80 z-10">
              <button onClick={() => setIsCropOpen(false)}><X className="w-6 h-6 text-white" /></button>
              <span className="font-bold text-white">이미지 편집</span>
              <button onClick={handleCropSave} className="px-5 py-2 bg-brand-DEFAULT rounded-full font-black text-sm text-white">완료</button>
            </div>
            <div className="relative flex-1 bg-black">
              <Cropper image={tempImageSrc} crop={crop} zoom={zoom} aspect={currentImageType === 'avatar' ? 1 : 16/9} onCropChange={setCrop} onCropComplete={(_, p) => setCroppedAreaPixels(p)} onZoomChange={setZoom} cropShape={currentImageType === 'avatar' ? 'round' : 'rect'} showGrid={false} />
            </div>
            <div className="h-24 bg-black/80 flex items-center justify-center px-10 gap-4">
              <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="flex-1 accent-brand-DEFAULT" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}