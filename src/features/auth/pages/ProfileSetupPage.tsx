import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Check, Image as ImageIcon, X, Eye, User as UserIcon } from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

type ImageType = 'avatar_url' | 'background';

async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
 
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Canvas toBlob failed'));
          }
        },
        'image/jpeg',
        0.95
      );
    };
    image.onerror = () => reject(new Error('Image load failed'));
    image.src = imageSrc;
  });
}

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
  const [isSaving, setIsSaving] = useState(false);
  const [currentImageType, setCurrentImageType] = useState<ImageType>('avatar_url');
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchSignupData = async () => {
      const signupUserId = sessionStorage.getItem('signup_user_id');
      
      if (!signupUserId && !user) {
        toast.error('회원가입 정보를 찾을 수 없습니다.');
        navigate('/auth/signup', { replace: true });
        return;
      }

      if (signupUserId || user?.id) {
        try {
        // ✅ user_profiles에서 nickname 먼저 조회, 없으면 users.name으로 폴백
        const { data: profileData } = await supabase
          .from('user_profiles')
          .select('nickname')
          .eq('user_id', signupUserId || user?.id)
          .maybeSingle();

        if (profileData?.nickname) {
          setNickname(profileData.nickname);
        } else {
          // 폴백: users.name (실명)
          const { data: userData } = await supabase
            .from('users')
            .select('name')
            .eq('id', signupUserId || user?.id)
            .maybeSingle();

          if (userData?.name && userData.name !== '사용자') {
            setNickname(userData.name);
          }
        }
        } catch (err) {
          console.error('Fetch user data error:', err);
        }
      }
    };

    fetchSignupData();
  }, [user, navigate]);

  const isFormValid = useMemo(() => {
    return nickname.trim().length >= 2;
  }, [nickname]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: ImageType) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('이미지 파일만 업로드 가능합니다.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setTempImageSrc(reader.result as string);
      setCurrentImageType(type);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setIsCropOpen(true);
    };
    reader.onerror = () => {
      toast.error('파일을 읽는 중 오류가 발생했습니다.');
    };
    reader.readAsDataURL(file);

    e.target.value = '';
  }, []);

  const handleCropSave = useCallback(async () => {
    if (!tempImageSrc || !croppedAreaPixels) return;

    try {
      const blob = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      const url = URL.createObjectURL(blob);

      if (currentImageType === 'avatar_url') {
        if (avatarUrl) URL.revokeObjectURL(avatarUrl);
        setAvatarUrl(url);
        setAvatarBlob(blob);
      } else {
        if (backgroundUrl) URL.revokeObjectURL(backgroundUrl);
        setBackgroundUrl(url);
        setBgBlob(blob);
      }

      setIsCropOpen(false);
      setTempImageSrc(null);
      toast.success('이미지가 설정되었습니다.');
    } catch (error) {
      console.error('Image crop error:', error);
      toast.error('이미지 편집 중 오류가 발생했습니다.');
    }
  }, [tempImageSrc, croppedAreaPixels, currentImageType, avatarUrl, backgroundUrl]);

  const uploadImage = useCallback(async (blob: Blob, type: ImageType): Promise<string | null> => {
    const userId = user?.id || sessionStorage.getItem('signup_user_id');
    if (!userId) return null;

    const fileExt = 'jpg';
    const fileName = `${userId}/${type}_${Date.now()}.${fileExt}`;

    try {
      const { data, error } = await supabase.storage
        .from('profiles')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) throw error;

      const { data: publicUrlData } = supabase.storage
        .from('profiles')
        .getPublicUrl(data.path);

      return publicUrlData.publicUrl;
    } catch (error) {
      console.error(`${type} upload error:`, error);
      throw error;
    }
  }, [user]);

  const handleComplete = useCallback(async () => {
    const userId = user?.id || sessionStorage.getItem('signup_user_id');
    
    if (!userId) {
      toast.error('사용자 정보를 찾을 수 없습니다.');
      return;
    }

    if (!isFormValid) {
      toast.error('닉네임을 2자 이상 입력해주세요.');
      return;
    }

    setIsSaving(true);

    try {
      let finalAvatar: string | null = null;
      let finalBg: string | null = null;

      if (avatarBlob) {
        finalAvatar = await uploadImage(avatarBlob, 'avatar_url');
      }

      if (bgBlob) {
        finalBg = await uploadImage(bgBlob, 'background');
      }

      // [핵심] 전화번호가 metadata에는 있는데 DB에 없다면 DB로 복사
      const metaPhone = user?.user_metadata?.phone || user?.user_metadata?.mobile;
      
        // 전화번호가 새로 들어온 경우에만 업데이트하도록 변경합니다.
        if (metaPhone || user?.phone) {
          const { error: updateError } = await supabase
            .from('users')
            .update({
              phone: metaPhone || user?.phone,
              updated_at: new Date().toISOString(),
            })
            .eq('id', userId);

          if (updateError) throw updateError;
        }

        // 2. user_profiles 테이블: 여기서만 닉네임을 처리합니다.
        const profilesUpdateData: any = {
          user_id: userId,
          nickname: nickname.trim(), // 앱에서 표시될 이름
          status_message: statusMessage.trim() || '그레인을 시작했어요!',
          profile_updated_at: new Date().toISOString(),
        };

        if (finalAvatar) profilesUpdateData.avatar_url = finalAvatar;
        if (finalBg) profilesUpdateData.bg_image = finalBg;

        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert(profilesUpdateData, { onConflict: 'user_id' });

        if (profileError) throw profileError;

      sessionStorage.removeItem('signup_email');
      sessionStorage.removeItem('signup_password');
      sessionStorage.removeItem('signup_user_id');

      toast.success('그레인 가입을 환영합니다! 🎉');

      setTimeout(() => {
        navigate('/main/friends', { replace: true });
      }, 800);
      
    } catch (error) {
      console.error('Profile save error:', error);
      toast.error('프로필 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [user, nickname, statusMessage, avatarBlob, bgBlob, isFormValid, uploadImage, navigate]);

  return (
    <div className="h-[100dvh] flex flex-col bg-dark-bg text-white overflow-hidden font-sans">
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="relative w-full shrink-0">
          <div 
            onClick={() => backgroundInputRef.current?.click()} 
            className="h-56 bg-[#1C1C1E] cursor-pointer overflow-hidden group border-b border-[#2C2C2E]"
          >
            {backgroundUrl ? (
              <img 
                src={backgroundUrl} 
                className="w-full h-full object-cover opacity-60 group-hover:opacity-40 transition-opacity" 
                alt="Background" 
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[#48484A] gap-2">
                <ImageIcon className="w-8 h-8 opacity-20" />
                <span className="text-xs font-medium">배경 사진 추가</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <Camera className="w-8 h-8 text-white drop-shadow-md" />
            </div>
          </div>

          <div className="absolute -bottom-14 left-1/2 -translate-x-1/2">
            <div 
              onClick={() => avatarInputRef.current?.click()} 
              className="relative cursor-pointer group"
            >
              <div className="w-32 h-32 rounded-[40px] border-[6px] border-dark-bg bg-[#2C2C2E] overflow-hidden flex items-center justify-center shadow-2xl relative">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    className="w-full h-full object-cover group-hover:opacity-60 transition-opacity" 
                    alt="Avatar" 
                  />
                ) : (
                  <UserIcon className="w-12 h-12 opacity-20 text-[#8E8E93]" />
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              <div className="absolute bottom-0 right-0 w-9 h-9 bg-brand-DEFAULT rounded-2xl flex items-center justify-center border-4 border-dark-bg shadow-lg">
                <Camera className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 pt-20 pb-36">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-black mb-2 tracking-tight">프로필 설정</h2>
            <p className="text-[#8E8E93] text-sm leading-relaxed">
              회원님을 표현할 수 있는<br/>멋진 프로필을 완성해 주세요.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] font-black text-[#636366] ml-1 tracking-widest uppercase">
                닉네임
              </label>
              <input 
                type="text" 
                value={nickname} 
                onChange={e => setNickname(e.target.value)} 
                placeholder="닉네임을 입력해 주세요" 
                maxLength={20}
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl py-4 px-5 text-[15px] text-white focus:ring-2 focus:ring-brand-DEFAULT focus:border-transparent outline-none transition-all placeholder-[#48484A]" 
              />
              <p className="text-xs text-[#636366] ml-1">
                {nickname.length}/20자
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black text-[#636366] ml-1 tracking-widest uppercase">
                상태 메시지 (선택)
              </label>
              <input 
                type="text" 
                value={statusMessage} 
                onChange={e => setStatusMessage(e.target.value)} 
                placeholder="상태 메시지를 입력해 주세요" 
                maxLength={50}
                className="w-full bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl py-4 px-5 text-[15px] text-white focus:ring-2 focus:ring-brand-DEFAULT focus:border-transparent outline-none transition-all placeholder-[#48484A]" 
              />
              <p className="text-xs text-[#636366] ml-1">
                {statusMessage.length}/50자
              </p>
            </div>

            <button 
              onClick={() => setIsPreviewOpen(true)} 
              className="w-full py-4 rounded-2xl bg-[#2C2C2E] border border-[#3A3A3C] text-[#E5E5EA] font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-[#3A3A3C]"
            >
              <Eye className="w-4 h-4" /> 프로필 미리보기
            </button>
          </div>
        </div>
      </div>

      <div className="shrink-0 p-6 bg-gradient-to-t from-dark-bg via-dark-bg to-transparent pb-safe">
        <button 
          onClick={handleComplete} 
          disabled={!isFormValid || isSaving} 
          className={`w-full h-14 rounded-2xl font-black text-lg flex items-center justify-center gap-2 shadow-2xl transition-all active:scale-[0.98] ${
            isFormValid && !isSaving
              ? 'bg-brand-DEFAULT text-white shadow-brand-DEFAULT/30' 
              : 'bg-[#2C2C2E] text-[#48484A] cursor-not-allowed'
          }`}
        >
          {isSaving ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              저장 중...
            </>
          ) : (
            <>
              그레인 시작하기 {isFormValid && <Check className="w-5 h-5 ml-1" />}
            </>
          )}
        </button>
      </div>

      <input 
        type="file" 
        ref={avatarInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={e => onFileChange(e, 'avatar_url')} 
      />
      <input 
        type="file" 
        ref={backgroundInputRef} 
        className="hidden" 
        accept="image/*" 
        onChange={e => onFileChange(e, 'background')} 
      />

      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/95 backdrop-blur-sm" 
              onClick={() => setIsPreviewOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }} 
              className="relative bg-[#1C1C1E] w-full max-w-[340px] rounded-[40px] overflow-hidden shadow-2xl border border-[#2C2C2E]"
            >
              <button 
                onClick={() => setIsPreviewOpen(false)} 
                className="absolute top-5 right-5 z-20 p-2 bg-black/40 rounded-full text-white backdrop-blur-md hover:bg-black/60 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="h-60 bg-[#2C2C2E] relative overflow-hidden">
                {backgroundUrl && (
                  <img src={backgroundUrl} className="w-full h-full object-cover" alt="Preview" />
                )}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/60" />
              </div>
              <div className="px-6 pb-10 -mt-14 relative z-10 flex flex-col items-center text-center">
                <div className="w-28 h-28 rounded-[38px] border-4 border-[#1C1C1E] bg-[#2C2C2E] overflow-hidden mb-5 shadow-2xl">
                  {avatarUrl ? (
                    <img src={avatarUrl} className="w-full h-full object-cover" alt="Preview" />
                  ) : (
                    <div className="w-full h-full bg-[#3A3A3C] flex items-center justify-center">
                      <UserIcon className="w-10 h-10 opacity-20" />
                    </div>
                  )}
                </div>
                <h3 className="text-2xl font-black text-white mb-2">
                  {nickname || '그레인 친구'}
                </h3>
                <p className="text-[#8E8E93] text-[14px] leading-relaxed max-w-[80%] break-keep">
                  {statusMessage || '그레인을 시작했어요!'}
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCropOpen && tempImageSrc && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-5 bg-black/90 backdrop-blur-md z-10 shrink-0">
              <button 
                onClick={() => {
                  setIsCropOpen(false);
                  setTempImageSrc(null);
                }} 
                className="p-2 -ml-2 text-white"
              >
                <X className="w-7 h-7" />
              </button>
              <span className="font-bold text-lg text-white">이미지 편집</span>
              <button 
                onClick={handleCropSave} 
                className="px-5 py-2 bg-brand-DEFAULT rounded-full font-black text-sm text-white shadow-lg hover:bg-brand-hover transition-colors"
              >
                완료
              </button>
            </div>
            <div className="relative flex-1 bg-black">
              <Cropper 
                image={tempImageSrc} 
                crop={crop} 
                zoom={zoom} 
                aspect={currentImageType === 'avatar_url' ? 1 : 16/9} 
                onCropChange={setCrop} 
                onCropComplete={(_, p) => setCroppedAreaPixels(p)} 
                onZoomChange={setZoom} 
                cropShape={currentImageType === 'avatar_url' ? 'round' : 'rect'}
                showGrid={false}
              />
            </div>
            <div className="h-24 bg-black/90 backdrop-blur-md flex items-center justify-center px-10 gap-4 shrink-0">
              <span className="text-white text-sm font-medium">확대</span>
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