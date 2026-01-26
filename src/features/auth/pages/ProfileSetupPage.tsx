import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, Image as ImageIcon, X, ZoomIn, Eye, MessageCircle, Trash2 } from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import toast from 'react-hot-toast';

// === [유틸리티] 이미지 크롭 함수 ===
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height
  );
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      resolve(URL.createObjectURL(blob));
    }, 'image/jpeg');
  });
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.src = url;
  });
// ========================================================

interface ProfileSetupPageProps {
  onComplete: () => void;
}

type ImageType = 'avatar' | 'background';

export default function ProfileSetupPage({ onComplete }: ProfileSetupPageProps) {
  // === 상태 관리 ===
  const [nickname, setNickname] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  
  // 이미지 데이터
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);

  // 모달 상태들
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // ✨ 삭제 확인 모달 상태 (시스템 알럿 대체)
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ImageType | null>(null);

  // 크롭 관련 상태
  const [currentImageType, setCurrentImageType] = useState<ImageType>('avatar');
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  // 1. 파일 선택
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: ImageType) => {
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

  // 2. 이미지 초기화 요청 (모달 띄우기)
  const handleRemoveClick = (e: React.MouseEvent, type: ImageType) => {
    e.stopPropagation(); // 파일 선택창 열림 방지
    setDeleteTarget(type); // 무엇을 지울지 저장
    setShowDeleteAlert(true); // ✨ 커스텀 모달 열기
  };

  // 3. 실제 삭제 실행 (모달에서 '확인' 클릭 시)
  const confirmDelete = () => {
    if (deleteTarget === 'avatar') setAvatarUrl(null);
    else if (deleteTarget === 'background') setBackgroundUrl(null);
    
    setShowDeleteAlert(false);
    setDeleteTarget(null);
    toast.success('기본 이미지로 변경되었습니다.');
  };

  // 4. 크롭 완료/저장
  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixels: Area) => {
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
      toast.success('이미지가 적용되었습니다.');
    } catch (e) {
      toast.error('오류가 발생했습니다.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-dark-bg text-white relative overflow-hidden">
      
      {/* === [UI 섹션 1] 편집 영역 === */}
      <div className="relative w-full">
        
        {/* A. 배경 설정 */}
        <div 
          onClick={() => backgroundInputRef.current?.click()}
          className="relative w-full h-48 bg-[#2C2C2E] cursor-pointer group overflow-hidden"
        >
          {backgroundUrl ? (
            <>
              <img src={backgroundUrl} alt="Background" className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" />
              {/* 배경 삭제 버튼 */}
              <button
                onClick={(e) => handleRemoveClick(e, 'background')}
                className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-red-500/80 rounded-full text-white backdrop-blur-sm transition-colors z-20"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#8E8E93] gap-2">
              <ImageIcon className="w-8 h-8 opacity-50" />
              <span className="text-xs">배경 사진 추가</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <Camera className="w-8 h-8 text-white drop-shadow-lg" />
          </div>
        </div>

        {/* B. 프로필 사진 설정 */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
          <div 
            onClick={() => avatarInputRef.current?.click()}
            className="relative cursor-pointer group"
          >
            <div className="w-28 h-28 rounded-full border-4 border-dark-bg bg-[#3A3A3C] overflow-hidden shadow-xl flex items-center justify-center relative">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" />
              ) : (
                <UserPlaceholder />
              )}
            </div>
            
            <div className="absolute bottom-0 right-0 w-8 h-8 bg-brand-DEFAULT rounded-full flex items-center justify-center border-2 border-dark-bg shadow-lg z-10 group-hover:scale-110 transition-transform">
              <Camera className="w-4 h-4 text-white" />
            </div>

            {/* 프로필 삭제 버튼 */}
            {avatarUrl && (
              <button
                onClick={(e) => handleRemoveClick(e, 'avatar')}
                className="absolute top-0 left-0 w-8 h-8 bg-[#2C2C2E] hover:bg-red-500 rounded-full flex items-center justify-center border-2 border-dark-bg shadow-lg z-20 transition-colors"
              >
                <Trash2 className="w-4 h-4 text-white" />
              </button>
            )}
          </div>
        </div>

        <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange(e, 'avatar')} />
        <input type="file" ref={backgroundInputRef} className="hidden" accept="image/*" onChange={(e) => onFileChange(e, 'background')} />
      </div>

      {/* === [UI 섹션 2] 입력 폼 === */}
      <div className="flex-1 px-6 pt-16 pb-32">
        <div className="text-center mb-8">
          <h2 className="text-xl font-bold text-white">프로필 설정</h2>
          <p className="text-[#8E8E93] text-sm mt-1">나를 표현할 정보를 입력해주세요.</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-medium text-[#8E8E93] ml-1">닉네임</label>
            <input 
              type="text" 
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임 입력"
              className="w-full bg-dark-input border border-transparent focus:border-brand-DEFAULT rounded-xl py-4 px-6 text-lg text-white placeholder-[#636366] focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-[#8E8E93] ml-1">상태 메시지 (선택)</label>
            <input 
              type="text" 
              value={statusMessage}
              onChange={(e) => setStatusMessage(e.target.value)}
              placeholder="상태 메시지 입력"
              className="w-full bg-dark-input border border-transparent focus:border-brand-DEFAULT rounded-xl py-4 px-6 text-base text-white placeholder-[#636366] focus:outline-none transition-all"
            />
          </div>

          <button
            onClick={() => setIsPreviewOpen(true)}
            className="w-full py-4 rounded-xl border border-[#3A3A3C] bg-[#2C2C2E] text-[#E5E5EA] font-medium flex items-center justify-center gap-2 hover:bg-[#3A3A3C] transition-all"
          >
            <Eye className="w-5 h-5" />
            프로필 미리보기
          </button>
        </div>
      </div>

      {/* === [UI 섹션 3] 시작 버튼 === */}
      <div className="fixed bottom-0 left-0 w-full p-6 bg-gradient-to-t from-dark-bg via-dark-bg to-transparent z-10">
        <button
          onClick={onComplete}
          disabled={!nickname}
          className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg transition-all ${
            nickname 
              ? 'bg-brand-DEFAULT text-white hover:bg-brand-hover shadow-brand-DEFAULT/20 cursor-pointer' 
              : 'bg-[#2C2C2E] text-[#636366] cursor-not-allowed'
          }`}
        >
          GRAYN 시작하기
          {nickname && <Check className="w-5 h-5" />}
        </button>
      </div>


      {/* ======================================================= */}
      {/* ✨ [모달 1] 삭제 확인 (시스템 알럿 대체) */}
      {/* ======================================================= */}
      <AnimatePresence>
        {showDeleteAlert && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowDeleteAlert(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative bg-[#1C1C1E] w-full max-w-[320px] rounded-2xl p-6 text-center shadow-2xl border border-[#2C2C2E]"
            >
              <h3 className="text-white text-lg font-bold mb-2">
                기본 이미지로<br/>변경하시겠습니까?
              </h3>
              <p className="text-[#8E8E93] text-sm mb-6 leading-relaxed">
                설정된 사진이 초기화됩니다.
              </p>
              
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteAlert(false)}
                  className="flex-1 h-12 rounded-xl bg-[#2C2C2E] text-[#8E8E93] font-medium hover:bg-[#3A3A3C] transition-colors"
                >
                  취소
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 h-12 rounded-xl bg-[#EC5022] text-white font-bold hover:bg-red-600 transition-colors"
                >
                  변경
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ======================================================= */}
      {/* ✨ [모달 2] 프로필 미리보기 */}
      {/* ======================================================= */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setIsPreviewOpen(false)}
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-[340px] bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-2xl border border-[#2C2C2E]"
            >
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 z-20 p-2 bg-black/30 rounded-full text-white backdrop-blur-md hover:bg-black/50 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              {/* 배경 */}
              <div className="h-64 bg-[#2C2C2E] relative">
                {backgroundUrl ? (
                  <img src={backgroundUrl} alt="Background" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#2C2C2E] to-[#1C1C1E]">
                    <span className="text-[#636366] text-sm">배경 없음</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 w-full h-24 bg-gradient-to-t from-[#1C1C1E] to-transparent" />
              </div>

              {/* 정보 */}
              <div className="px-6 pb-8 -mt-12 relative z-10 flex flex-col items-center text-center">
                <div className="w-24 h-24 rounded-full border-[3px] border-[#1C1C1E] bg-[#2C2C2E] overflow-hidden shadow-lg mb-4">
                   {avatarUrl ? (
                     <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                   ) : (
                     <UserPlaceholder />
                   )}
                </div>

                <h3 className="text-xl font-bold text-white mb-1">
                  {nickname || '닉네임'}
                </h3>

                {statusMessage && (
                  <p className="text-[#8E8E93] text-sm max-w-[80%] break-keep leading-relaxed mb-6">
                    {statusMessage}
                  </p>
                )}
                
                {/* 액션 버튼 */}
                <div className="flex gap-6 mt-4 w-full justify-center">
                  <div className="flex flex-col items-center gap-1 group cursor-not-allowed opacity-50">
                    <div className="w-12 h-12 rounded-full bg-[#2C2C2E] group-hover:bg-[#3A3A3C] flex items-center justify-center text-white transition-colors border border-[#3A3A3C]">
                      <MessageCircle className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] text-[#8E8E93]">1:1 채팅</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* ======================================================= */}
      {/* ✨ [모달 3] 이미지 자르기 */}
      {/* ======================================================= */}
      <AnimatePresence>
        {isCropOpen && tempImageSrc && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-4 bg-black/50 absolute top-0 left-0 w-full z-10">
              <button onClick={() => setIsCropOpen(false)} className="p-2 text-white">
                <X className="w-6 h-6" />
              </button>
              <span className="font-bold text-lg">
                {currentImageType === 'avatar' ? '프로필 사진 편집' : '배경 사진 편집'}
              </span>
              <button onClick={handleCropSave} className="px-4 py-2 bg-brand-DEFAULT rounded-full text-sm font-bold text-white">
                완료
              </button>
            </div>
            <div className="relative flex-1 bg-black">
              <Cropper
                image={tempImageSrc}
                crop={crop}
                zoom={zoom}
                aspect={currentImageType === 'avatar' ? 1 : 16 / 9}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                cropShape={currentImageType === 'avatar' ? 'round' : 'rect'}
                showGrid={false}
              />
            </div>
            <div className="h-24 bg-[#1C1C1E] flex items-center px-6 gap-4 pb-safe">
              <ZoomIn className="w-5 h-5 text-[#8E8E93]" />
              <input
                type="range" value={zoom} min={1} max={3} step={0.1}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-brand-DEFAULT h-1 bg-[#3A3A3C] rounded-lg appearance-none"
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
    <div className="w-full h-full flex flex-col items-center justify-center text-[#8E8E93] bg-[#2C2C2E]">
      <svg className="w-8 h-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    </div>
  );
}