import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, 
  Camera, User, Mail, Phone, Globe, LogOut, 
  Trash2, Image as ImageIcon, X, Search, CheckCircle2, Circle // ✨ Check 제거됨
} from 'lucide-react';
import toast from 'react-hot-toast';

// === [Types] ===
interface UserProfile {
  name: string;
  avatar: string | null;
  bg: string | null;
  provider: 'kakao' | 'naver' | 'google' | 'email';
  email: string;
  phone: string;
}

interface Country {
  code: string;
  name: string;
  flag: string;
}

// === [Mock Data] ===
const MOCK_USER: UserProfile = {
  name: '임정민',
  avatar: 'https://i.pravatar.cc/150?u=me',
  bg: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=1000&auto=format&fit=crop',
  provider: 'kakao',
  email: 'grayn@kakao.com',
  phone: '010-1234-5678'
};

const COUNTRIES: Country[] = [
  { code: 'US', name: '미국', flag: '🇺🇸' },
  { code: 'CN', name: '중국', flag: '🇨🇳' },
  { code: 'JP', name: '일본', flag: '🇯🇵' },
  { code: 'VN', name: '베트남', flag: '🇻🇳' },
  { code: 'TH', name: '태국', flag: '🇹🇭' },
  { code: 'GB', name: '영국', flag: '🇬🇧' },
  { code: 'DE', name: '독일', flag: '🇩🇪' },
  { code: 'FR', name: '프랑스', flag: '🇫🇷' },
  { code: 'RU', name: '러시아', flag: '🇷🇺' },
  { code: 'CA', name: '캐나다', flag: '🇨🇦' },
];

export default function AccountInfoPage() {
  const navigate = useNavigate();
  
  // 상태 관리
  const [profile, setProfile] = useState<UserProfile>(MOCK_USER);
  const [blockedCountries, setBlockedCountries] = useState<string[]>([]);
  
  // 모달 상태
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<'avatar' | 'bg' | null>(null); // 이미지 변경 타겟
  
  // 로그아웃 모달 상태 추가
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // 파일 인풋 Refs
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  // === Handlers ===

  // 1. 이미지 변경 핸들러
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'bg') => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setProfile(prev => ({ ...prev, [type]: reader.result as string }));
        toast.success(type === 'avatar' ? '프로필 사진이 변경되었습니다.' : '배경 사진이 변경되었습니다.');
      };
      reader.readAsDataURL(file);
      setEditTarget(null); // 액션 시트 닫기
    }
  };

  // 2. 이미지 초기화 (기본값)
  const handleResetImage = (type: 'avatar' | 'bg') => {
    setProfile(prev => ({ ...prev, [type]: null }));
    toast.success('기본 이미지로 변경되었습니다.');
    setEditTarget(null);
  };

  // 3. 로그아웃 버튼 클릭 (모달 열기)
  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  // 4. 로그아웃 확정 (실제 동작)
  const handleLogoutConfirm = () => {
    // 로컬 데이터 삭제
    localStorage.removeItem('login_provider');
    
    // 앱 전체 새로고침 (스플래시 화면부터 다시 시작)
    window.location.reload();
  };

  // 로그인 제공자 아이콘/텍스트
  const getProviderInfo = () => {
    switch (profile.provider) {
      case 'kakao': return { label: '카카오 로그인', color: 'text-yellow-400' };
      case 'naver': return { label: '네이버 로그인', color: 'text-green-500' };
      default: return { label: '이메일 로그인', color: 'text-white' };
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === Header === */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">계정 정보</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        {/* === 1. Profile Section (배경 + 프사) === */}
        <div className="relative mb-16">
          {/* 배경 사진 */}
          <div 
            onClick={() => setEditTarget('bg')}
            className="h-48 w-full bg-[#2C2C2E] relative cursor-pointer group"
          >
            {profile.bg ? (
              <img src={profile.bg} alt="Background" className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#8E8E93] gap-2">
                <ImageIcon className="w-6 h-6" />
                <span className="text-sm">배경 사진 설정</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-8 h-8 text-white drop-shadow-md" />
            </div>
          </div>

          {/* 프로필 사진 (겹침) */}
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
            <div 
              onClick={() => setEditTarget('avatar')}
              className="w-24 h-24 rounded-full border-4 border-dark-bg bg-[#3A3A3C] overflow-hidden cursor-pointer group relative shadow-xl"
            >
              {profile.avatar ? (
                <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-70 transition-opacity" />
              ) : (
                <User className="w-10 h-10 text-[#8E8E93] m-auto mt-6" />
              )}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white drop-shadow-md" />
              </div>
            </div>
          </div>
        </div>

        {/* 이름 및 로그인 정보 */}
        <div className="text-center mb-8 px-5">
          <h2 className="text-xl font-bold text-white mb-1">{profile.name}</h2>
          <p className={`text-xs font-medium ${getProviderInfo().color} flex items-center justify-center gap-1`}>
            {getProviderInfo().label}
            <span className="w-1 h-1 rounded-full bg-current opacity-50" />
            <span className="text-[#8E8E93] font-normal">{profile.email}</span>
          </p>
        </div>

        {/* === 2. Account Info (계정 정보) === */}
        <div className="px-5 space-y-6">
          <Section label="계정 정보">
            <InfoItem label="대표 이메일" value={profile.email} icon={<Mail className="w-5 h-5" />} />
            <InfoItem label="전화번호" value={profile.phone} icon={<Phone className="w-5 h-5" />} />
            <InfoItem label="이름" value={profile.name} icon={<User className="w-5 h-5" />} />
          </Section>

          <Section label="계정 보안">
            <button 
              onClick={() => setIsCountryModalOpen(true)}
              className="w-full flex items-center justify-between px-5 py-4 bg-[#2C2C2E] rounded-2xl hover:bg-[#3A3A3C] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-[#8E8E93]" />
                <div className="text-left">
                  <p className="text-[15px] text-white">국가별 로그인 제한</p>
                  <p className="text-xs text-[#8E8E93] mt-0.5">
                    {blockedCountries.length > 0 
                      ? `${blockedCountries.length}개국 차단 중` 
                      : '차단된 국가 없음'}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
            </button>
          </Section>

          {/* 로그아웃 버튼 */}
          <button 
            onClick={handleLogoutClick}
            className="w-full py-4 text-[#EC5022] text-[15px] font-medium hover:bg-white/5 rounded-2xl transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            로그아웃
          </button>
        </div>
      </div>

      {/* Hidden File Inputs */}
      <input type="file" ref={bgInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'bg')} />
      <input type="file" ref={avatarInputRef} className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'avatar')} />

      {/* === Modals === */}
      
      {/* 1. 이미지 변경 액션 시트 */}
      <AnimatePresence>
        {editTarget && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setEditTarget(null)}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
            <motion.div 
              initial={{ y: '100%' }} 
              animate={{ y: 0 }} 
              exit={{ y: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative z-10 w-full max-w-[480px] bg-[#1C1C1E] rounded-t-3xl overflow-hidden p-6 pb-safe"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-center text-white font-bold text-lg mb-6">
                {editTarget === 'avatar' ? '프로필 사진 설정' : '배경 사진 설정'}
              </h3>
              <div className="space-y-3">
                <button 
                  onClick={() => (editTarget === 'avatar' ? avatarInputRef : bgInputRef).current?.click()}
                  className="w-full py-3.5 bg-[#2C2C2E] rounded-xl text-white font-medium hover:bg-[#3A3A3C] flex items-center justify-center gap-2"
                >
                  <ImageIcon className="w-5 h-5" /> 앨범에서 선택
                </button>
                <button 
                  onClick={() => handleResetImage(editTarget)}
                  className="w-full py-3.5 bg-[#2C2C2E] rounded-xl text-[#EC5022] font-medium hover:bg-[#3A3A3C] flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" /> 기본값으로 변경
                </button>
              </div>
              <button onClick={() => setEditTarget(null)} className="w-full mt-4 py-3 text-[#8E8E93] text-sm">취소</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. 국가 제한 모달 */}
      <CountrySelectModal 
        isOpen={isCountryModalOpen} 
        onClose={() => setIsCountryModalOpen(false)}
        blockedList={blockedCountries}
        onSave={setBlockedCountries}
      />

      {/* 3. 로그아웃 확인 모달 */}
      <LogoutModal 
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={handleLogoutConfirm}
      />
    </div>
  );
}

// === [Sub Components] ===

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2">{label}</h3>
      <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C]">
        {children}
      </div>
    </div>
  );
}

function InfoItem({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 text-[#8E8E93] flex justify-center">{icon}</div>
        <span className="text-[15px] text-white">{label}</span>
      </div>
      <span className="text-[15px] text-[#E5E5EA] font-medium">{value}</span>
    </div>
  );
}

// 국가 선택 모달
function CountrySelectModal({ 
  isOpen, onClose, blockedList, onSave 
}: { 
  isOpen: boolean; onClose: () => void; 
  blockedList: string[]; onSave: (list: string[]) => void 
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>(blockedList);

  useEffect(() => { if (isOpen) setSelected(blockedList); }, [isOpen, blockedList]);

  const toggleCountry = (code: string) => {
    setSelected(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const handleSave = () => {
    onSave(selected);
    onClose();
    toast.success('로그인 제한 국가가 설정되었습니다.');
  };

  const filtered = COUNTRIES.filter(c => c.name.includes(search));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
        className="relative z-10 w-full max-w-sm bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] flex flex-col max-h-[600px]"
        onClick={e => e.stopPropagation()}
      >
        <div className="h-14 flex items-center justify-between px-5 bg-[#2C2C2E] shrink-0">
          <h3 className="text-white font-bold text-lg">로그인 제한 국가 선택</h3>
          <button onClick={onClose}><X className="w-6 h-6 text-[#8E8E93]" /></button>
        </div>
        
        <div className="p-4 bg-[#1C1C1E] border-b border-[#2C2C2E]">
          <div className="bg-[#2C2C2E] rounded-xl flex items-center px-3 py-2.5">
            <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
            <input 
              value={search} onChange={e => setSearch(e.target.value)} 
              placeholder="국가명 검색" 
              className="bg-transparent text-white text-sm w-full focus:outline-none"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {filtered.map(country => (
            <button 
              key={country.code} 
              onClick={() => toggleCountry(country.code)}
              className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-[#2C2C2E] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{country.flag}</span>
                <span className="text-white font-medium">{country.name}</span>
              </div>
              {selected.includes(country.code) ? (
                <CheckCircle2 className="w-5 h-5 text-brand-DEFAULT fill-brand-DEFAULT/20" />
              ) : (
                <Circle className="w-5 h-5 text-[#3A3A3C]" />
              )}
            </button>
          ))}
        </div>

        <div className="p-4 bg-[#1C1C1E] border-t border-[#2C2C2E]">
          <button onClick={handleSave} className="w-full h-11 bg-brand-DEFAULT text-white font-bold rounded-xl hover:bg-brand-hover transition-colors">
            {selected.length}개국 차단 적용
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// 로그아웃 확인 모달 컴포넌트
function LogoutModal({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="relative z-10 w-full max-w-[280px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center"
      >
        <div className="p-6">
          <h3 className="text-white font-bold text-lg mb-2">로그아웃</h3>
          <p className="text-[#8E8E93] text-sm">정말 로그아웃 하시겠습니까?</p>
        </div>
        <div className="flex border-t border-[#3A3A3C] h-12">
          <button 
            onClick={onClose} 
            className="flex-1 text-[#8E8E93] font-medium text-[16px] hover:bg-[#2C2C2E] transition-colors border-r border-[#3A3A3C]"
          >
            취소
          </button>
          <button 
            onClick={onConfirm} 
            className="flex-1 text-[#FF453A] font-bold text-[16px] hover:bg-[#2C2C2E] transition-colors"
          >
            로그아웃
          </button>
        </div>
      </motion.div>
    </div>
  );
}