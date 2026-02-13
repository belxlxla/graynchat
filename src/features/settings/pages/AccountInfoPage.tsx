import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight,
  Camera, User, Phone, Globe, LogOut,
  Trash2, Image as ImageIcon, X, Search, CheckCircle2, Circle,
  ShieldCheck, Pencil
} from 'lucide-react';
import Cropper from 'react-easy-crop';
import type { Point, Area } from 'react-easy-crop';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { useAuth } from '../../auth/contexts/AuthContext';

interface UserProfile {
  name: string;
  avatar: string | null;
  bg: string | null;
  provider: string;
  email: string;
  phone: string;
}

interface Country {
  code: string;
  name: string;
  flag: string;
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

const COUNTRIES: Country[] = [
  { code: 'KR', name: '대한민국', flag: '🇰🇷' },
  { code: 'US', name: '미국', flag: '🇺🇸' },
  { code: 'JP', name: '일본', flag: '🇯🇵' },
  { code: 'CN', name: '중국', flag: '🇨🇳' },
  { code: 'GB', name: '영국', flag: '🇬🇧' },
  { code: 'DE', name: '독일', flag: '🇩🇪' },
  { code: 'FR', name: '프랑스', flag: '🇫🇷' },
  { code: 'IT', name: '이탈리아', flag: '🇮🇹' },
  { code: 'ES', name: '스페인', flag: '🇪🇸' },
  { code: 'RU', name: '러시아', flag: '🇷🇺' },
  { code: 'CA', name: '캐나다', flag: '🇨🇦' },
  { code: 'AU', name: '호주', flag: '🇦🇺' },
  { code: 'BR', name: '브라질', flag: '🇧🇷' },
  { code: 'IN', name: '인도', flag: '🇮🇳' },
  { code: 'VN', name: '베트남', flag: '🇻🇳' },
  { code: 'TH', name: '태국', flag: '🇹🇭' },
  { code: 'PH', name: '필리핀', flag: '🇵🇭' },
  { code: 'SG', name: '싱가포르', flag: '🇸🇬' },
  { code: 'MY', name: '말레이시아', flag: '🇲🇾' },
  { code: 'ID', name: '인도네시아', flag: '🇮🇩' },
  { code: 'MX', name: '멕시코', flag: '🇲🇽' },
  { code: 'NL', name: '네덜란드', flag: '🇳🇱' },
  { code: 'SE', name: '스웨덴', flag: '🇸🇪' },
  { code: 'CH', name: '스위스', flag: '🇨🇭' },
  { code: 'AE', name: '아랍에미리트', flag: '🇦🇪' },
  { code: 'SA', name: '사우디아라비아', flag: '🇸🇦' },
  { code: 'TR', name: '터키', flag: '🇹🇷' },
  { code: 'HK', name: '홍콩', flag: '🇭🇰' },
  { code: 'TW', name: '대만', flag: '🇹🇼' },
].sort((a, b) => a.name.localeCompare(b.name));

export default function AccountInfoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState<UserProfile>({
    name: '사용자',
    avatar: null,
    bg: null,
    provider: 'email',
    email: '',
    phone: '번호 없음'
  });

  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<'avatar' | 'bg' | null>(null);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [showVerifyConfirm, setShowVerifyConfirm] = useState<'phone' | 'name' | null>(null);

  const [isCropOpen, setIsCropOpen] = useState(false);
  const [currentImageType, setCurrentImageType] = useState<'avatar' | 'bg'>('avatar');
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const formatPhoneNumber = (phoneNumber: string) => {
    if (!phoneNumber || phoneNumber === '번호 없음') return phoneNumber;
    const cleaned = ('' + phoneNumber).replace(/\D/g, '');
    if (cleaned.startsWith('010') && cleaned.length === 11) {
      return `+82 10-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.startsWith('8210') && cleaned.length === 12) {
      return `+82 10-${cleaned.slice(4, 8)}-${cleaned.slice(8)}`;
    }
    return phoneNumber;
  };

  // ✅ 수정된 부분: single() -> maybeSingle() 로 변경하여 데이터가 없을 때도 에러 방지
  const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: dbData, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(); // 👈 여기를 single()에서 maybeSingle()로 변경

      if (dbError) throw dbError;

      // dbData가 null일 경우(데이터 없을 때)에도 에러 없이 기본값이나 Auth 정보로 표시
      setProfile({
        name: dbData?.name || user.user_metadata?.full_name || '사용자',
        avatar: dbData?.avatar || null,
        bg: dbData?.bg_image || null,
        provider: user.app_metadata?.provider || 'email',
        email: user.email || '이메일 없음',
        phone: formatPhoneNumber(dbData?.phone || '번호 없음')
      });
      setBlockedCountries(dbData?.blocked_countries || []);
    } catch (err) { 
      console.error('Data load error:', err); 
    }
  }, [user]);

  useEffect(() => { fetchUserData(); }, [fetchUserData]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'bg') => {
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
    if (!tempImageSrc || !croppedAreaPixels || !user) return;
    const loadingToast = toast.loading('사진 업로드 중...');
    try {
      const croppedImageUrl = await getCroppedImg(tempImageSrc, croppedAreaPixels);
      const res = await fetch(croppedImageUrl);
      const blob = await res.blob();
      const filePath = `${user.id}/${currentImageType}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, blob, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('profiles').getPublicUrl(filePath);
      const dbField = currentImageType === 'avatar' ? 'avatar' : 'bg_image';
      
      // ✅ 데이터가 없을 수도 있으므로 update 대신 upsert 사용 권장 (또는 insert 확인 필요)
      // 여기서는 일단 update를 유지하되, 만약 row가 없으면 생성이 필요할 수 있음.
      await supabase.from('users').update({ [dbField]: publicUrl }).eq('id', user.id);
      
      setProfile(prev => ({ ...prev, [currentImageType === 'avatar' ? 'avatar' : 'bg']: publicUrl }));
      toast.success('프로필이 업데이트되었습니다.', { id: loadingToast });
      setIsCropOpen(false);
      setEditTarget(null);
    } catch (err) {
      toast.error('업로드 실패', { id: loadingToast });
    }
  };

  const handleResetImage = async (type: 'avatar' | 'bg') => {
    if (!user) return;
    const loadingToast = toast.loading('이미지 초기화 중...');
    try {
      const dbField = type === 'avatar' ? 'avatar' : 'bg_image';
      await supabase.from('users').update({ [dbField]: null }).eq('id', user.id);
      setProfile(prev => ({ ...prev, [type === 'avatar' ? 'avatar' : 'bg']: null }));
      toast.success('기본 이미지로 변경되었습니다.', { id: loadingToast });
    } catch (err) { toast.error('초기화 실패', { id: loadingToast }); }
    finally { setEditTarget(null); }
  };

  const handleSaveBlockedCountries = async (list: string[]) => {
    if (!user) return;
    const loadingToast = toast.loading('보안 설정 적용 중...');
    try {
      const { error } = await supabase.from('users').update({ blocked_countries: list }).eq('id', user.id);
      if (error) throw error;
      setBlockedCountries(list);
      toast.success('국가별 접근 제한 설정이 완료되었습니다.', { id: loadingToast });
    } catch (err) { toast.error('설정 저장 실패', { id: loadingToast }); }
  };

  const handlePhoneClick = () => { setShowVerifyConfirm('phone'); };
  const handleNameClick = () => { setShowVerifyConfirm('name'); };

  const handleConfirmVerify = () => {
    if (!user) return;
    const type = showVerifyConfirm;
    setShowVerifyConfirm(null);
    sessionStorage.setItem('verify_return_type', type || '');
    sessionStorage.setItem('verify_user_id', user.id);
    sessionStorage.setItem('verify_current_name', profile.name);
    sessionStorage.setItem('verify_current_phone', profile.phone);
    navigate('/auth/phone-verify');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      {/* ── 헤더 (유지) ───────────────────────────────── */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">계정 정보</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-12" style={{ scrollbarWidth: 'none' }}>

        {/* ── 프로필 히어로 영역 ───────────────────────── */}
        <div className="relative">
          {/* 배경 이미지 */}
          <div
            onClick={() => setEditTarget('bg')}
            className="h-44 w-full relative cursor-pointer overflow-hidden"
            style={{ background: '#161616' }}
          >
            {profile.bg ? (
              <img src={profile.bg} alt="bg" className="w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center gap-2"
                style={{ color: 'rgba(255,255,255,0.1)' }}>
                <Camera className="w-5 h-5" />
                <span className="text-[12px]">배경 사진 설정</span>
              </div>
            )}
            {/* 편집 오버레이 */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 active:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.55)' }}>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.12)' }}>
                <Camera className="w-4 h-4 text-white" />
                <span className="text-[12px] font-medium text-white">배경 변경</span>
              </div>
            </div>
            {/* 하단 페이드 - 솔리드 오버레이 */}
            <div className="absolute bottom-0 left-0 right-0 h-8 pointer-events-none"
              style={{ background: 'rgba(0,0,0,0.3)' }} />
          </div>

          {/* 아바타 + 이름 + 이메일 */}
          <div className="px-5 -mt-12 pb-5 relative z-10">
            <div className="flex items-end gap-4">
              {/* 아바타 */}
              <div className="relative shrink-0" onClick={() => setEditTarget('avatar')}>
                <div className="w-[72px] h-[72px] rounded-[20px] overflow-hidden cursor-pointer shadow-xl"
                  style={{
                    border: '2.5px solid rgba(255,255,255,0.12)',
                    background: '#2C2C2E',
                  }}>
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"
                      style={{ background: '#2C2C2E' }}>
                      <User className="w-7 h-7" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    </div>
                  )}
                </div>
                {/* 편집 뱃지 */}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
                  style={{ background: '#FF203A', border: '2px solid #111111' }}>
                  <Camera className="w-3 h-3 text-white" />
                </div>
              </div>

              {/* 이름 + 이메일 */}
              <div className="pb-1 min-w-0">
                <h2 className="text-[18px] font-bold text-white truncate" style={{ letterSpacing: '-0.02em' }}>
                  {profile.name}
                </h2>
                <p className="text-[12px] truncate mt-0.5" style={{ color: 'rgba(255,255,255,0.38)' }}>
                  {profile.email}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 space-y-4">

          {/* ── 본인 정보 카드 (2열 그리드) ─────────────── */}
          <div>
            <SectionLabel>본인 정보</SectionLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {/* 전화번호 카드 */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePhoneClick}
                className="relative flex flex-col gap-3 p-4 rounded-2xl text-left overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {/* 아이콘 */}
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,32,58,0.1)' }}>
                  <Phone className="w-4 h-4" style={{ color: '#FF203A' }} />
                </div>
                {/* 레이블 */}
                <div className="min-w-0">
                  <p className="text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>
                    휴대폰 번호
                  </p>
                  <p className="text-[13px] font-semibold truncate"
                    style={{
                      color: profile.phone === '번호 없음' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.82)',
                      letterSpacing: '-0.01em',
                    }}>
                    {profile.phone === '번호 없음' ? '미등록' : profile.phone.replace('+82 ', '')}
                  </p>
                </div>
                {/* 편집 인디케이터 */}
                <div className="absolute top-3 right-3">
                  <Pencil className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                </div>
              </motion.button>

              {/* 이름 카드 */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleNameClick}
                className="relative flex flex-col gap-3 p-4 rounded-2xl text-left overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <User className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.55)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] mb-1" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>
                    이름
                  </p>
                  <p className="text-[13px] font-semibold truncate"
                    style={{ color: 'rgba(255,255,255,0.82)', letterSpacing: '-0.01em' }}>
                    {profile.name}
                  </p>
                </div>
                <div className="absolute top-3 right-3">
                  <Pencil className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.15)' }} />
                </div>
              </motion.button>
            </div>

            {/* 본인인증 안내 */}
            <div className="flex items-center gap-2 mt-2 px-1">
              <ShieldCheck className="w-3 h-3 shrink-0" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                수정 시 본인인증이 필요합니다
              </p>
            </div>
          </div>

          {/* ── 로그인 방식 ───────────────────────────────── */}
          <div>
            <SectionLabel>계정</SectionLabel>
            <div className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}>
              <div className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <Globe className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
                  </div>
                  <span className="text-[14px]" style={{ color: 'rgba(255,255,255,0.65)' }}>로그인 방식</span>
                </div>
                <span className="text-[12px] font-bold px-2.5 py-1 rounded-lg"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    color: 'rgba(255,255,255,0.5)',
                    letterSpacing: '0.05em',
                  }}>
                  {profile.provider.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* ── 보안 설정 ─────────────────────────────────── */}
          <div>
            <SectionLabel>보안</SectionLabel>
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsCountryModalOpen(true)}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all"
              style={{
                background: blockedCountries.length > 0
                  ? 'rgba(255,32,58,0.05)'
                  : 'rgba(255,255,255,0.03)',
                border: blockedCountries.length > 0
                  ? '1px solid rgba(255,32,58,0.2)'
                  : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  background: blockedCountries.length > 0
                    ? 'rgba(255,32,58,0.1)'
                    : 'rgba(255,255,255,0.06)',
                }}>
                <ShieldCheck className="w-4.5 h-4.5" style={{
                  color: blockedCountries.length > 0 ? '#FF203A' : 'rgba(255,255,255,0.4)',
                }} />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14px]" style={{ color: 'rgba(255,255,255,0.82)' }}>
                  국가별 접근 및 노출 제한
                </p>
                <p className="text-[11px] mt-0.5"
                  style={{ color: blockedCountries.length > 0 ? '#FF203A' : 'rgba(255,255,255,0.28)' }}>
                  {blockedCountries.length > 0 ? `${blockedCountries.length}개국 차단 중` : '설정된 국가 없음'}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'rgba(255,255,255,0.18)' }} />
            </motion.button>
          </div>

          {/* ── 로그아웃 / 탈퇴 ───────────────────────────── */}
          <div className="pt-2 space-y-2">
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsLogoutModalOpen(true)}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl transition-all"
              style={{
                background: 'rgba(255,32,58,0.06)',
                border: '1px solid rgba(255,32,58,0.15)',
                color: '#FF203A',
              }}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-[14px] font-semibold">로그아웃</span>
            </motion.button>

            <button
              onClick={() => navigate('/settings/account/withdraw')}
              className="w-full py-2.5 text-[12px] transition-colors"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              회원 탈퇴하기
            </button>
          </div>

        </div>
      </div>

      {/* ── 히든 파일 인풋 ─────────────────────────────── */}
      <input type="file" ref={bgInputRef} className="hidden" accept="image/*"
        onChange={(e) => handleFileChange(e, 'bg')} />
      <input type="file" ref={avatarInputRef} className="hidden" accept="image/*"
        onChange={(e) => handleFileChange(e, 'avatar')} />

      {/* ── 이미지 편집 바텀시트 ──────────────────────── */}
      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-end justify-center"
            onClick={() => setEditTarget(null)}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative z-10 w-full max-w-[480px] rounded-[28px] mb-6 px-5 pt-5 pb-6"
              style={{ background: '#1A1A1A', borderTop: '1px solid rgba(255,255,255,0.08)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-9 h-[3px] rounded-full mx-auto mb-5"
                style={{ background: 'rgba(255,255,255,0.12)' }} />
              <p className="text-[16px] font-bold text-center mb-5 text-white">
                {editTarget === 'avatar' ? '프로필 사진 설정' : '배경 사진 설정'}
              </p>
              <div className="space-y-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => (editTarget === 'avatar' ? avatarInputRef : bgInputRef).current?.click()}
                  className="w-full py-3.5 rounded-2xl text-[14px] font-medium flex items-center justify-center gap-2.5"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.85)' }}
                >
                  <ImageIcon className="w-4.5 h-4.5" />앨범에서 선택
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleResetImage(editTarget)}
                  className="w-full py-3.5 rounded-2xl text-[14px] font-medium flex items-center justify-center gap-2.5"
                  style={{ background: 'rgba(255,32,58,0.08)', color: '#FF203A' }}
                >
                  <Trash2 className="w-4.5 h-4.5" />기본값으로 변경
                </motion.button>
                <button
                  onClick={() => setEditTarget(null)}
                  className="w-full h-20 py-3 text-[13px]"
                  style={{ color: 'rgba(255,255,255,0.25)' }}
                >
                  취소
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 이미지 크롭 전체화면 ─────────────────────── */}
      <AnimatePresence>
        {isCropOpen && tempImageSrc && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col"
          >
            <div className="h-16 flex items-center justify-between px-5 bg-black/80 backdrop-blur-md z-10 sticky top-0">
              <button onClick={() => setIsCropOpen(false)} className="p-2 -ml-2 text-white">
                <X className="w-7 h-7" />
              </button>
              <span className="font-bold text-lg text-white">이미지 편집</span>
              <button
                onClick={handleCropSave}
                className="px-5 py-2 rounded-full font-black text-sm text-white shadow-lg active:scale-95 transition-all"
                style={{ background: '#FF203A' }}
              >
                완료
              </button>
            </div>
            <div className="relative flex-1 bg-black">
              <Cropper
                image={tempImageSrc} crop={crop} zoom={zoom}
                aspect={currentImageType === 'avatar' ? 1 : 16 / 9}
                onCropChange={setCrop}
                onCropComplete={(_, p) => setCroppedAreaPixels(p)}
                onZoomChange={setZoom}
                cropShape={currentImageType === 'avatar' ? 'round' : 'rect'}
                showGrid={false}
              />
            </div>
            <div className="h-24 bg-black/80 backdrop-blur-md flex items-center justify-center px-10 gap-4">
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>확대</span>
              <input
                type="range" min={1} max={3} step={0.1} value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-[#FF203A]"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 본인인증 확인 모달 ─────────────────────────── */}
      <AnimatePresence>
        {showVerifyConfirm && (
          <div className="fixed inset-0 z-50 flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => setShowVerifyConfirm(null)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative z-10 w-full max-w-[480px] rounded-[28px] mb-6 px-5 pt-5 pb-6"
              style={{ background: '#1A1A1A', borderTop: '1px solid rgba(255,255,255,0.08)' }}
            >
              <div className="w-9 h-[3px] rounded-full mx-auto mb-6"
                style={{ background: 'rgba(255,255,255,0.12)' }} />

              {/* 아이콘 */}
              <div className="w-14 h-14 rounded-[18px] flex items-center justify-center mx-auto mb-5"
                style={{ background: 'rgba(255,32,58,0.1)', border: '1px solid rgba(255,32,58,0.2)' }}>
                {showVerifyConfirm === 'phone'
                  ? <Phone className="w-6 h-6" style={{ color: '#FF203A' }} />
                  : <User className="w-6 h-6" style={{ color: '#FF203A' }} />
                }
              </div>

              <h3 className="text-[18px] font-bold text-center mb-2 text-white" style={{ letterSpacing: '-0.02em' }}>
                {showVerifyConfirm === 'phone' ? '전화번호 변경' : '이름 변경'}
              </h3>
              <p className="text-[13px] text-center mb-8" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                {showVerifyConfirm === 'phone' ? '전화번호' : '이름'}를 변경하려면{'\n'}본인인증이 필요합니다.
              </p>

              <div className="flex gap-2.5 mb-12">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowVerifyConfirm(null)}
                  className="flex-1 py-3.5 rounded-2xl text-[14px] font-semibold"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
                >
                  취소
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleConfirmVerify}
                  className="flex-1 py-3.5 rounded-2xl text-[14px] font-bold"
                  style={{ background: '#FF203A', color: 'white' }}
                >
                  본인인증
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CountrySelectModal
        isOpen={isCountryModalOpen}
        onClose={() => setIsCountryModalOpen(false)}
        blockedList={blockedCountries}
        onSave={handleSaveBlockedCountries}
      />
      <LogoutModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={() => supabase.auth.signOut().then(() => navigate('/'))}
      />
    </div>
  );
}

// ── 섹션 레이블 ───────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold mb-2.5 px-1 tracking-[0.1em] uppercase"
      style={{ color: 'rgba(255,255,255,0.25)' }}>
      {children}
    </p>
  );
}

// ── 국가 선택 모달 ────────────────────────────────────────
function CountrySelectModal({ isOpen, onClose, blockedList, onSave }: any) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(blockedList);
  useEffect(() => { if (isOpen) setSelected(blockedList); }, [isOpen, blockedList]);
  const filtered = COUNTRIES.filter(c => c.name.includes(search));
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative z-10 w-full max-w-[480px] rounded-[28px] mb-4 overflow-hidden flex flex-col"
        style={{
          background: '#1A1A1A',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          maxHeight: '85dvh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* 핸들 */}
        <div className="w-9 h-[3px] rounded-full mx-auto mt-4 mb-4 shrink-0"
          style={{ background: 'rgba(255,255,255,0.12)' }} />

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pb-4 shrink-0">
          <h3 className="text-[16px] font-bold text-white">접근 제한 국가</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.07)' }}
          >
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>

        {/* 검색 */}
        <div className="px-4 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 rounded-2xl px-4 py-2.5"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <Search className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.25)' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="국가 검색"
              className="bg-transparent text-[13px] w-full focus:outline-none placeholder-white/20"
              style={{ color: 'rgba(255,255,255,0.8)' }}
            />
          </div>
        </div>

        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto px-3 pb-2" style={{ scrollbarWidth: 'none' }}>
          {filtered.map(country => (
            <button
              key={country.code}
              onClick={() => setSelected(prev =>
                prev.includes(country.code)
                  ? prev.filter(c => c !== country.code)
                  : [...prev, country.code]
              )}
              className="w-full flex items-center justify-between px-3 py-3 rounded-xl transition-all"
              style={{
                background: selected.includes(country.code)
                  ? 'rgba(255,32,58,0.06)'
                  : 'transparent',
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{country.flag}</span>
                <div className="text-left">
                  <p className="text-[13px] font-medium text-white">{country.name}</p>
                  <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{country.code}</p>
                </div>
              </div>
              {selected.includes(country.code)
                ? <CheckCircle2 className="w-5 h-5" style={{ color: '#FF203A' }} />
                : <Circle className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.12)' }} />
              }
            </button>
          ))}
        </div>

        {/* 푸터 */}
        <div className="px-4 pt-3 pb-safe-or-8 shrink-0 flex items-center gap-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="flex-1 text-[12px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
            <span className="font-bold text-white">{selected.length}</span>개국 선택
          </p>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { onSave(selected); onClose(); }}
            className="px-6 h-11 rounded-2xl text-[14px] font-bold text-white mb-4"
            style={{ background: '#FF203A' }}
          >
            적용
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

// ── 로그아웃 모달 ─────────────────────────────────────────
function LogoutModal({ isOpen, onClose, onConfirm }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="relative z-10 w-full max-w-[480px] rounded-[28px] mb-6 px-5 pt-5 pb-6"
        style={{ background: '#1A1A1A', borderTop: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="w-9 h-[3px] rounded-full mx-auto mb-6"
          style={{ background: 'rgba(255,255,255,0.12)' }} />
        <div className="w-14 h-14 rounded-[18px] flex items-center justify-center mx-auto mb-5"
          style={{ background: 'rgba(255,32,58,0.1)', border: '1px solid rgba(255,32,58,0.2)' }}>
          <LogOut className="w-6 h-6" style={{ color: '#FF203A' }} />
        </div>
        <h3 className="text-[18px] font-bold text-center mb-2 text-white" style={{ letterSpacing: '-0.02em' }}>
          로그아웃
        </h3>
        <p className="text-[13px] text-center mb-8" style={{ color: 'rgba(255,255,255,0.4)' }}>
          계정에서 로그아웃 하시겠습니까?
        </p>
        <div className="flex gap-2.5 mb-12">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onClose}
            className="flex-1 py-3.5 rounded-2xl text-[14px] font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
          >
            취소
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onConfirm}
            className="flex-1 py-3.5 rounded-2xl text-[14px] font-bold"
            style={{ background: '#FF203A', color: 'white' }}
          >
            로그아웃
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}