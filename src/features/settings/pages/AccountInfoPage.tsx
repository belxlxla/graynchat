import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, 
  Camera, User, Phone, Globe, LogOut, 
  Trash2, Image as ImageIcon, X, Search, CheckCircle2, Circle
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

  const fetchUserData = useCallback(async () => {
    if (!user) return;
    try {
      const { data: dbData, error: dbError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      if (dbError) throw dbError;
      setProfile({
        name: dbData?.name || user.user_metadata?.full_name || '사용자',
        avatar: dbData?.avatar || null,
        bg: dbData?.bg_image || null,
        provider: user.app_metadata?.provider || 'email',
        email: user.email || '이메일 없음',
        phone: formatPhoneNumber(dbData?.phone || '번호 없음')
      });
      setBlockedCountries(dbData?.blocked_countries || []);
    } catch (err) { console.error('Data load error:', err); }
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

  const handlePhoneClick = () => {
    setShowVerifyConfirm('phone');
  };

  const handleNameClick = () => {
    setShowVerifyConfirm('name');
  };

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
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">계정 정보</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        <div className="relative mb-16">
          <div onClick={() => setEditTarget('bg')} className="h-48 w-full bg-[#2C2C2E] relative cursor-pointer group overflow-hidden">
            {profile.bg ? <img src={profile.bg} alt="bg" className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" /> : <div className="w-full h-full flex items-center justify-center text-[#8E8E93] gap-2"><ImageIcon className="w-6 h-6" /><span className="text-sm">배경 사진 설정</span></div>}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-8 h-8 text-white drop-shadow-md" /></div>
          </div>
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
            <div onClick={() => setEditTarget('avatar')} className="w-24 h-24 rounded-full border-4 border-dark-bg bg-[#3A3A3C] overflow-hidden cursor-pointer group relative shadow-xl">
              {profile.avatar ? <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" /> : <User className="w-10 h-10 text-[#8E8E93] m-auto mt-6" />}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera className="w-6 h-6 text-white drop-shadow-md" /></div>
            </div>
          </div>
        </div>

        <div className="text-center mb-8 px-5">
          <h2 className="text-xl font-bold text-white mb-1">{profile.name}</h2>
          <p className="text-xs text-[#8E8E93]">{profile.email}</p>
        </div>

        <div className="px-5 space-y-6">
          <Section label="기본 정보">
            <button onClick={handlePhoneClick} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 text-[#8E8E93] flex justify-center items-center"><Phone className="w-5 h-5" /></div>
                <span className="text-[15px] text-white">휴대폰 번호</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] text-[#E5E5EA] font-medium font-mono">{profile.phone}</span>
                <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
              </div>
            </button>
            <div className="h-[1px] bg-[#3A3A3C] mx-4" />
            <button onClick={handleNameClick} className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 text-[#8E8E93] flex justify-center items-center"><User className="w-5 h-5" /></div>
                <span className="text-[15px] text-white">이름</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[15px] text-[#E5E5EA] font-medium font-mono">{profile.name}</span>
                <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
              </div>
            </button>
            <div className="h-[1px] bg-[#3A3A3C] mx-4" />
            <InfoItem label="로그인 방식" value={profile.provider.toUpperCase()} icon={<Globe className="w-5 h-5" />} />
          </Section>

          <Section label="보안 설정">
            <button onClick={() => setIsCountryModalOpen(true)} className="w-full flex items-center justify-between px-5 py-4 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors group">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-[#8E8E93]" />
                <div className="text-left">
                  <p className="text-[15px] text-white">국가별 접근 및 노출 제한</p>
                  <p className={`text-xs mt-0.5 ${blockedCountries.length > 0 ? 'text-brand-DEFAULT font-bold' : 'text-[#8E8E93]'}`}>
                    {blockedCountries.length > 0 ? `${blockedCountries.length}개국 차단 중` : '설정된 국가 없음'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
            </button>
          </Section>

          <div className="flex flex-col items-center gap-4 mt-6">
            <button onClick={() => setIsLogoutModalOpen(true)} className="w-full py-4 text-[#FF203A] text-[15px] font-medium hover:bg-white/5 rounded-2xl transition-colors flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" />로그아웃
            </button>
            <button onClick={() => navigate('/settings/account/withdraw')} className="text-[12px] text-[#48484A] underline underline-offset-2 hover:text-[#8E8E93] transition-colors">회원 탈퇴하기</button>
          </div>
        </div>
      </div>

      <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'bg')} />
      <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'avatar')} />

      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditTarget(null)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: "spring", damping: 25, stiffness: 300 }} className="relative z-10 w-full max-w-[480px] bg-[#1C1C1E] rounded-t-3xl overflow-hidden p-6 pb-safe" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-center text-white font-bold text-lg mb-6">{editTarget === 'avatar' ? '프로필 사진 설정' : '배경 사진 설정'}</h3>
              <div className="space-y-3">
                <button onClick={() => (editTarget === 'avatar' ? avatarInputRef : bgInputRef).current?.click()} className="w-full py-3.5 bg-[#2C2C2E] rounded-xl text-white font-medium hover:bg-[#3A3A3C] flex items-center justify-center gap-2"><ImageIcon className="w-5 h-5" /> 앨범에서 선택</button>
                <button onClick={() => handleResetImage(editTarget)} className="w-full py-3.5 bg-[#2C2C2E] rounded-xl text-[#FF203A] font-medium hover:bg-[#3A3A3C] flex items-center justify-center gap-2"><Trash2 className="w-5 h-5" /> 기본값으로 변경</button>
              </div>
              <button onClick={() => setEditTarget(null)} className="w-full mt-4 py-3 text-[#8E8E93] text-sm">취소</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCropOpen && tempImageSrc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black flex flex-col">
            <div className="h-16 flex items-center justify-between px-5 bg-black/80 backdrop-blur-md z-10 sticky top-0">
              <button onClick={() => setIsCropOpen(false)} className="p-2 -ml-2 text-white"><X className="w-7 h-7" /></button>
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
               <span className="text-xs text-[#8E8E93]">확대</span>
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

      <AnimatePresence>
        {showVerifyConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowVerifyConfirm(null)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
              <div className="p-8">
                <div className="w-16 h-16 bg-brand-DEFAULT/10 rounded-full flex items-center justify-center mx-auto mb-6">
                  {showVerifyConfirm === 'phone' ? <Phone className="w-8 h-8 text-brand-DEFAULT" /> : <User className="w-8 h-8 text-brand-DEFAULT" />}
                </div>
                <h3 className="text-white font-bold text-xl mb-2">본인 정보 변경</h3>
                <p className="text-[#8E8E93] text-[15px] leading-relaxed">
                  {showVerifyConfirm === 'phone' ? '전화번호' : '이름'}를 변경하려면 본인인증이 필요합니다.
                </p>
              </div>
              <div className="flex border-t border-[#2C2C2E] h-14">
                <button onClick={() => setShowVerifyConfirm(null)} className="flex-1 text-[#8E8E93] font-bold border-r border-[#2C2C2E]">취소</button>
                <button onClick={handleConfirmVerify} className="flex-1 text-brand-DEFAULT font-bold">본인인증</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CountrySelectModal isOpen={isCountryModalOpen} onClose={() => setIsCountryModalOpen(false)} blockedList={blockedCountries} onSave={handleSaveBlockedCountries} />
      <LogoutModal isOpen={isLogoutModalOpen} onClose={() => setIsLogoutModalOpen(false)} onConfirm={() => supabase.auth.signOut().then(() => navigate('/'))} />
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div><h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2 tracking-wider uppercase">{label}</h3><div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C] shadow-sm">{children}</div></div>
  );
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4"><div className="flex items-center gap-3"><div className="w-5 h-5 text-[#8E8E93] flex justify-center items-center">{icon}</div><span className="text-[15px] text-white">{label}</span></div><span className="text-[15px] text-[#E5E5EA] font-medium font-mono">{value}</span></div>
  );
}

function CountrySelectModal({ isOpen, onClose, blockedList, onSave }: any) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(blockedList);
  useEffect(() => { if (isOpen) setSelected(blockedList); }, [isOpen, blockedList]);
  const filtered = COUNTRIES.filter(c => c.name.includes(search));
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative z-10 w-full max-w-[400px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
        <div className="h-14 flex items-center justify-between px-5 bg-[#2C2C2E] shrink-0"><h3 className="text-white font-bold text-lg">접근 제한 국가 선택</h3><button onClick={onClose}><X className="w-6 h-6 text-[#8E8E93]" /></button></div>
        <div className="p-4 bg-[#1C1C1E] border-b border-[#2C2C2E]"><div className="bg-[#2C2C2E] rounded-xl flex items-center px-3 py-2.5"><Search className="w-4 h-4 text-[#8E8E93] mr-2" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="검색" className="bg-transparent text-white text-sm w-full focus:outline-none" /></div></div>
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {filtered.map(country => (
            <button key={country.code} onClick={() => setSelected(prev => prev.includes(country.code) ? prev.filter(c => c !== country.code) : [...prev, country.code])} className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#2C2C2E]">
              <div className="flex items-center gap-3"><span className="text-xl">{country.flag}</span><div className="flex flex-col items-start"><span className="text-white font-medium">{country.name}</span><span className="text-[10px] text-[#636366]">{country.code}</span></div></div>
              {selected.includes(country.code) ? <CheckCircle2 className="w-5 h-5 text-brand-DEFAULT fill-brand-DEFAULT/20" /> : <Circle className="w-5 h-5 text-[#3A3A3C]" />}
            </button>
          ))}
        </div>
        <div className="p-4 bg-[#1C1C1E] border-t border-[#2C2C2E] flex items-center gap-3"><div className="flex-1 text-xs text-[#8E8E93]"><span className="text-white font-bold">{selected.length}</span>개국 선택됨</div><button onClick={() => { onSave(selected); onClose(); }} className="px-6 h-11 bg-brand-DEFAULT text-white font-bold rounded-xl">적용하기</button></div>
      </motion.div>
    </div>
  );
}

function LogoutModal({ isOpen, onClose, onConfirm }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-3xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center">
        <div className="p-8"><div className="w-16 h-16 bg-[#FF203A]/10 rounded-full flex items-center justify-center mx-auto mb-6"><LogOut className="w-8 h-8 text-[#FF203A]" />
        </div>
        <h3 className="text-white font-bold text-xl mb-2">로그아웃</h3>
        <p className="text-[#8E8E93] text-[15px] leading-relaxed">계정에서 로그아웃 하시겠습니까?</p></div>
        <div className="flex border-t border-[#2C2C2E] h-14">
          <button onClick={onClose} className="flex-1 text-[#8E8E93] font-bold border-r border-[#2C2C2E]">취소</button>
          <button onClick={onConfirm} className="flex-1 text-[#FF203A] font-bold">로그아웃</button>
        </div>
      </motion.div>
    </div>
  );
}