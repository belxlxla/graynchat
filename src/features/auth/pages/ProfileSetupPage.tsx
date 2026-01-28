import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, Image as ImageIcon, X, ZoomIn, Eye, MessageCircle, Trash2 } from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

// 유틸리티 함수
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
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });

interface ProfileSetupPageProps {
  onComplete: () => void;
}

type ImageType = 'avatar' | 'background';

export default function ProfileSetupPage({ onComplete }: ProfileSetupPageProps) {
  const { user } = useAuth(); // Context에서 가져오는 유저 정보
  const [nickname, setNickname] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImageType | null>(null);

  const [currentImageType, setCurrentImageType] = useState<ImageType>('avatar');
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: ImageType) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setTempImageSrc(reader.result as string);
        setCurrentImageType(type);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
        setIsCropOpen(true);
      });
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleRemoveClick = (e: React.MouseEvent, type: ImageType) => {
    e.stopPropagation();
    setDeleteTarget(type);
    setShowDeleteAlert(true);
  };

  const confirmDelete = () => {
    if (deleteTarget === 'avatar') setAvatarUrl(null);
    else if (deleteTarget === 'background') setBackgroundUrl(null);
    setShowDeleteAlert(false);
    setDeleteTarget(null);
    toast.success('초기화되었습니다.');
  };

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    if (!tempImageSrc || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      if (currentImageType === 'avatar') setAvatarUrl(croppedImage);
      else setBackgroundUrl(croppedImage);
      setIsCropOpen(false);
      setTempImageSrc(null);
      toast.success('적용되었습니다.');
    } catch (e) {
      toast.error('오류가 발생했습니다.');
    }
  };

  // ✨ 수정됨: 유저 ID 확인 로직 강화 (세션 리프레시 포함)
  const handleComplete = async () => {
    // 1. Context에 유저가 없으면 직접 세션을 확인
    let currentUserId = user?.id;
    let currentUserEmail = user?.email;

    if (!currentUserId) {
      // 1-1. 현재 세션 가져오기 시도
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.user) {
        currentUserId = sessionData.session.user.id;
        currentUserEmail = sessionData.session.user.email;
      } else {
        // 1-2. 세션이 없거나 만료된 것 같으면 강제 리프레시 시도 (회원가입 직후 이슈 방지)
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData.user) {
          currentUserId = refreshData.user.id;
          currentUserEmail = refreshData.user.email;
        }
      }
    }

    // 2. 모든 시도 후에도 없으면 에러
    if (!currentUserId) {
      toast.error('잠시 후 다시 시도해주세요. (인증 대기 중)');
      return;
    }
    
    try {
      // 3. users 테이블에 프로필 정보 업데이트
      const { error } = await supabase
        .from('users')
        .upsert({
          id: currentUserId, 
          name: nickname,
          status_message: statusMessage,
          avatar: avatarUrl, 
          email: currentUserEmail
        });

      if (error) throw error;

      onComplete(); // 완료 콜백 실행
    } catch (error) {
      console.error('Profile Update Error:', error);
      toast.error('프로필 저장에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-white relative overflow-hidden">
      
      {/* Background & Avatar UI */}
      <div className="relative w-full">
        <div onClick={() => backgroundInputRef.current?.click()} className="relative w-full h-48 bg-[#2C2C2E] cursor-pointer group overflow-hidden">
          {backgroundUrl ? (
            <>
              <img src={backgroundUrl} className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
              <button onClick={(e) => handleRemoveClick(e, 'background')} className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-red-500/80 rounded-full text-white backdrop-blur-sm transition-colors z-20">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#8E8E93] gap-2"><ImageIcon className="w-8 h-8 opacity-50" /><span className="text-xs">배경 사진</span></div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"><Camera className="w-8 h-8 text-white drop-shadow-lg" /></div>
        </div>

        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div onClick={() => avatarInputRef.current?.click()} className="relative cursor-pointer group">
            <div className="w-28 h-28 rounded-full border-4 border-dark-bg bg-[#3A3A3C] overflow-hidden shadow-xl flex items-center justify-center relative">
              {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" /> : <UserPlaceholder />}
            </div>
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-brand-DEFAULT rounded-full flex items-center justify-center border-2 border-dark-bg shadow-lg z-10"><Camera className="w-4 h-4 text-white" /></div>
            {avatarUrl && <button onClick={(e) => handleRemoveClick(e, 'avatar')} className="absolute top-0 left-0 w-8 h-8 bg-[#2C2C2E] hover:bg-red-500 rounded-full flex items-center justify-center border-2 border-dark-bg shadow-lg z-20 transition-colors"><Trash2 className="w-4 h-4 text-white" /></button>}
          </div>
        </div>
        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange(e, 'avatar')} />
        <input type="file" ref={backgroundInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange(e, 'background')} />
      </div>

      {/* Input Form */}
      <div className="flex-1 px-6 pt-16 pb-32">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-white">프로필 설정</h2>
          <p className="text-[#8E8E93] text-sm mt-1">나를 표현할 정보를 입력해주세요.</p>
        </div>
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#8E8E93] ml-1">닉네임</label>
            <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임 입력" className="w-full bg-[#2C2C2E] border border-transparent focus:border-brand-DEFAULT rounded-xl py-4 px-6 text-lg text-white placeholder-[#636366] focus:outline-none transition-all"/>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#8E8E93] ml-1">상태 메시지 (선택)</label>
            <input type="text" value={statusMessage} onChange={(e) => setStatusMessage(e.target.value)} placeholder="상태 메시지 입력" className="w-full bg-[#2C2C2E] border border-transparent focus:border-brand-DEFAULT rounded-xl py-4 px-6 text-base text-white placeholder-[#636366] focus:outline-none transition-all"/>
          </div>
          <button onClick={() => setIsPreviewOpen(true)} className="w-full py-4 rounded-xl border border-[#3A3A3C] bg-[#2C2C2E] text-[#E5E5EA] font-medium flex items-center justify-center gap-2 hover:bg-[#3A3A3C] transition-all"><Eye className="w-5 h-5" />프로필 미리보기</button>
        </div>
      </div>

      {/* Start Button */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-dark-bg via-dark-bg to-transparent z-10">
        <button onClick={handleComplete} disabled={!nickname} className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${nickname ? 'bg-brand-DEFAULT text-white hover:bg-brand-hover' : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'}`}>GRAYN 시작하기{nickname && <Check className="w-5 h-5" />}</button>
      </div>

      {/* Delete Alert Modal */}
      <AnimatePresence>
        {showDeleteAlert && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteAlert(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative bg-[#1C1C1E] w-full max-w-[320px] rounded-2xl p-6 text-center shadow-2xl border border-[#2C2C2E]">
              <h3 className="text-white text-lg font-bold mb-2">초기화 하시겠습니까?</h3>
              <div className="flex gap-3 mt-6"><button onClick={() => setShowDeleteAlert(false)} className="flex-1 h-12 rounded-xl bg-[#2C2C2E] text-[#8E8E93]">취소</button><button onClick={confirmDelete} className="flex-1 h-12 rounded-xl bg-[#EC5022] text-white font-bold">초기화</button></div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-[340px] bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-2xl border border-[#2C2C2E]">
              <button onClick={() => setIsPreviewOpen(false)} className="absolute top-4 right-4 z-20 p-2 bg-black/30 rounded-full text-white"><X className="w-5 h-5" /></button>
              <div className="h-64 bg-[#2C2C2E] relative">{backgroundUrl ? <img src={backgroundUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E]"><span className="text-[#636366] text-sm">배경 없음</span></div>}</div>
              <div className="px-6 pb-8 -mt-12 relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full border-[3px] border-[#1C1C1E] bg-[#2C2C2E] overflow-hidden shadow-lg mb-4">{avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" /> : <UserPlaceholder />}</div>
                <h3 className="text-xl font-bold text-white mb-1">{nickname || '닉네임'}</h3>
                {statusMessage && <p className="text-[#8E8E93] text-sm max-w-[80%] break-keep leading-relaxed mb-6">{statusMessage}</p>}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Crop Modal */}
      <AnimatePresence>
        {isCropOpen && tempImageSrc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] bg-black flex flex-col">
            <div className="h-16 flex items-center justify-between px-4 bg-black/50 absolute top-0 left-0 w-full z-10">
              <button onClick={() => setIsCropOpen(false)}><X className="w-6 h-6 text-white" /></button>
              <span className="font-bold text-lg text-white">이미지 편집</span>
              <button onClick={handleCropSave} className="px-4 py-2 bg-brand-DEFAULT rounded-full text-sm font-bold text-white">완료</button>
            </div>
            <div className="relative flex-1 bg-black">
              <Cropper image={tempImageSrc} crop={crop} zoom={zoom} aspect={currentImageType === 'avatar' ? 1 : 16/9} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} cropShape={currentImageType === 'avatar' ? 'round' : 'rect'} showGrid={false} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserPlaceholder() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-[#8E8E93] bg-[#2C2C2E]">
      <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    </div>
  );
}