import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, MapPin, Cloud, Sun, CloudRain, 
  Snowflake, ChevronRight, RefreshCw, X,
  CloudLightning, CloudFog, CloudDrizzle, Moon,
  User, Lock, Users, Bell, MessageCircle, Database, Monitor, Palette,
  Megaphone, Headphones, Info
} from 'lucide-react';
import toast from 'react-hot-toast';

// === [Types] ===
interface WeatherData {
  temp: number;
  code: number;
  location: string;
  isDay: boolean;
}

interface Banner {
  id: number;
  imageUrl: string;
  link: string;
  title: string;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  value?: string;
}

// === [Mock Data] ===
const MOCK_BANNERS: Banner[] = [
  { id: 1, imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?q=80&w=1000&auto=format&fit=crop', link: '#', title: '그레인 멤버십 혜택 모아보기' },
  { id: 2, imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1000&auto=format&fit=crop', link: '#', title: '이번 달 인기 이모티콘 할인' },
  { id: 3, imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=1000&auto=format&fit=crop', link: '#', title: '친구 초대하고 포인트 받자!' },
];

export default function SettingsPage() {
  const navigate = useNavigate();

  // === States ===
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);

  // 검색 상태
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 로그인 방식 상태 관리
  const [accountProvider, setAccountProvider] = useState('카카오 로그인');

  // === Effects ===
  useEffect(() => { loadWeather(); }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % MOCK_BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const provider = localStorage.getItem('login_provider'); 
    
    if (provider === 'naver') setAccountProvider('네이버 로그인');
    else if (provider === 'kakao') setAccountProvider('카카오 로그인');
    else if (provider === 'google') setAccountProvider('구글 로그인');
    else if (provider === 'email') setAccountProvider('이메일 로그인');
  }, []);

  // === Functions ===

  const handleMenuClick = (id: string) => {
    if (id === 'account') {
      navigate('/settings/account'); 
    } else if (id === 'privacy') { // ✨ 개인/보안 클릭 연결
      navigate('/settings/security');
    } else {
      toast('준비 중인 기능입니다.');
    }
  };

  const loadWeather = () => {
    if (!navigator.geolocation) return toast.error('위치 정보를 사용할 수 없습니다.');

    setLoadingWeather(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocationDenied(false);
        try {
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`
          );
          const weatherJson = await weatherRes.json();
          const current = weatherJson.current;

          const geoRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ko`
          );
          const geoJson = await geoRes.json();
          const locationName = geoJson.locality || geoJson.city || geoJson.principalSubdivision || '위치 확인 불가';

          setWeather({
            temp: Math.round(current.temperature_2m),
            code: current.weather_code,
            isDay: current.is_day === 1,
            location: locationName
          });
        } catch (e) {
          console.error(e);
          toast.error('날씨 정보를 불러오는데 실패했습니다.');
        } finally {
          setLoadingWeather(false);
        }
      },
      (error) => {
        console.error("위치 오류:", error);
        setLoadingWeather(false);
        setLocationDenied(true);
        if (error.code === 1) toast.error('위치 권한을 허용해주세요.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getWeatherDisplay = (code: number, isDay: boolean) => {
    if (code === 0) return { icon: isDay ? <Sun className="w-10 h-10 text-orange-400 drop-shadow-lg" /> : <Moon className="w-10 h-10 text-yellow-200 drop-shadow-lg" />, text: '맑음', bg: isDay ? 'from-blue-400/20 to-blue-600/20' : 'from-slate-800 to-slate-900' };
    if (code >= 1 && code <= 3) return { icon: <Cloud className="w-10 h-10 text-gray-300 drop-shadow-lg" />, text: code === 1 ? '대체로 맑음' : '흐림', bg: 'from-gray-400/20 to-gray-600/20' };
    if (code >= 45 && code <= 48) return { icon: <CloudFog className="w-10 h-10 text-slate-400 drop-shadow-lg" />, text: '안개', bg: 'from-slate-500/20 to-slate-700/20' };
    if (code >= 51 && code <= 67) return { icon: <CloudDrizzle className="w-10 h-10 text-blue-300 drop-shadow-lg" />, text: '비', bg: 'from-blue-500/30 to-blue-800/30' };
    if (code >= 71 && code <= 77) return { icon: <Snowflake className="w-10 h-10 text-white drop-shadow-lg" />, text: '눈', bg: 'from-sky-300/20 to-sky-600/20' };
    if (code >= 80 && code <= 82) return { icon: <CloudRain className="w-10 h-10 text-blue-400 drop-shadow-lg" />, text: '소나기', bg: 'from-indigo-400/20 to-indigo-800/20' };
    if (code >= 95) return { icon: <CloudLightning className="w-10 h-10 text-yellow-400 drop-shadow-lg" />, text: '뇌우', bg: 'from-purple-500/20 to-purple-900/20' };
    return { icon: <Sun className="w-10 h-10 text-orange-400" />, text: '맑음', bg: 'from-gray-700/20 to-gray-900/20' };
  };

  // === Menu Data Definition ===
  const settingsItems: MenuItem[] = [
    { id: 'account', label: '그레인 계정정보', icon: <User className="w-5 h-5 text-[#8E8E93]" />, value: accountProvider },
    { id: 'privacy', label: '개인/보안', icon: <Lock className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'friend', label: '친구', icon: <Users className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'noti', label: '알림', icon: <Bell className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'chat', label: '채팅', icon: <MessageCircle className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'backup', label: '백업', icon: <Database className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'display', label: '화면', icon: <Monitor className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'theme', label: '테마', icon: <Palette className="w-5 h-5 text-[#8E8E93]" /> },
  ];

  const serviceItems: MenuItem[] = [
    { id: 'notice', label: '공지사항', icon: <Megaphone className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'help', label: '그레인 고객센터/운영정책', icon: <Headphones className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'version', label: '앱 관리', icon: <Info className="w-5 h-5 text-[#8E8E93]" />, value: 'v1.0.0' },
  ];

  // ✨ 검색 필터링 로직
  const filteredSettings = useMemo(() => {
    if (!searchQuery) return settingsItems;
    return settingsItems.filter(item => item.label.includes(searchQuery));
  }, [searchQuery, settingsItems]);

  const filteredServices = useMemo(() => {
    if (!searchQuery) return serviceItems;
    return serviceItems.filter(item => item.label.includes(searchQuery));
  }, [searchQuery]);

  return (
    <div className="w-full h-full flex flex-col bg-dark-bg text-white pb-4">
      {/* === Header === */}
      <header className="h-14 px-4 flex items-center justify-between bg-dark-bg sticky top-0 z-10 shrink-0">
        <h1 className="text-xl font-bold ml-1">더보기</h1>
        <div className="flex gap-1">
          <button 
            onClick={() => setIsSearching(!isSearching)} 
            className={`p-2 transition-colors ${isSearching ? 'text-brand-DEFAULT' : 'text-white hover:text-brand-DEFAULT'}`}
          >
            <Search className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* === Search Bar === */}
      <AnimatePresence>
        {isSearching && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }} 
            animate={{ height: 'auto', opacity: 1 }} 
            exit={{ height: 0, opacity: 0 }} 
            className="overflow-hidden px-5 py-2 bg-dark-bg shrink-0"
          >
            <div className="bg-[#2C2C2E] rounded-xl flex items-center px-4 py-2">
              <Search className="w-4 h-4 text-[#8E8E93] mr-2" />
              <input 
                type="text" 
                placeholder="설정 메뉴 검색" 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                className="bg-transparent text-white placeholder-[#636366] text-sm w-full focus:outline-none" 
                autoFocus 
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X className="w-4 h-4 text-[#8E8E93]" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-8">
        
        {/* === 1. Weather Widget (검색 중이 아닐 때만 표시) === */}
        {!searchQuery && (
          <div className="px-5 py-4">
            <div className="relative w-full h-[90px] rounded-2xl overflow-hidden border border-white/10 shadow-lg">
              {loadingWeather ? (
                <div className="w-full h-full bg-[#2C2C2E] flex items-center justify-center gap-2 text-[#8E8E93] text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" /> 날씨 정보를 불러오는 중...
                </div>
              ) : locationDenied ? (
                <button onClick={loadWeather} className="w-full h-full bg-[#2C2C2E] flex flex-col items-center justify-center gap-1 hover:bg-[#3A3A3C] transition-colors">
                  <div className="flex items-center gap-1 text-brand-DEFAULT font-bold text-sm">
                    <MapPin className="w-4 h-4" /> 위치 정보 동의 필요
                  </div>
                  <p className="text-xs text-[#8E8E93]">탭하여 현재 날씨 확인하기</p>
                </button>
              ) : weather ? (
                (() => {
                  const display = getWeatherDisplay(weather.code, weather.isDay);
                  return (
                    <div className={`w-full h-full bg-gradient-to-br ${display.bg} backdrop-blur-md flex items-center justify-between px-6`}>
                      <div className="z-10 flex flex-col justify-center">
                        <p className="text-xs text-white/70 mb-0.5 flex items-center gap-1 font-medium">
                          <MapPin className="w-3 h-3" /> {weather.location}
                          <button onClick={loadWeather} className="ml-1 opacity-70 hover:opacity-100 p-1"><RefreshCw className="w-3 h-3" /></button>
                        </p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-white tracking-tight">{weather.temp}°</span>
                          <span className="text-sm font-medium text-white/80">{display.text}</span>
                        </div>
                      </div>
                      <div className="z-10 scale-110">{display.icon}</div>
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
                    </div>
                  );
                })()
              ) : (
                <div className="w-full h-full bg-[#2C2C2E] flex items-center justify-center text-sm text-[#8E8E93]">
                  <button onClick={loadWeather} className="flex items-center gap-2 hover:text-white transition-colors">
                    <RefreshCw className="w-4 h-4" /> 날씨 다시 불러오기
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* === 2. Ad Banner (검색 중이 아닐 때만 표시) === */}
        {!searchQuery && (
          <div className="px-5 mb-8">
            <div className="w-full aspect-[2.8/1] rounded-2xl overflow-hidden relative bg-[#2C2C2E] shadow-md group cursor-pointer">
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentBanner}
                  src={MOCK_BANNERS[currentBanner].imageUrl}
                  alt="Banner"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="w-full h-full object-cover absolute inset-0 opacity-80 group-hover:opacity-100 transition-opacity"
                />
              </AnimatePresence>
              <div className="absolute bottom-0 left-0 w-full p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                <p className="text-[13px] font-bold text-white drop-shadow-md line-clamp-1">{MOCK_BANNERS[currentBanner].title}</p>
              </div>
              <div className="absolute bottom-3 right-3 flex gap-1.5 bg-black/20 px-2 py-1 rounded-full backdrop-blur-sm">
                {MOCK_BANNERS.map((_, idx) => (
                  <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentBanner ? 'bg-white w-3' : 'bg-white/40'}`} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* === 3. Settings List (설정) === */}
        {filteredSettings.length > 0 && (
          <div className="px-5 space-y-4 mb-8">
            <SectionTitle title="설정" />
            <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
              {filteredSettings.map((item, index) => (
                <div key={item.id}>
                  <ListItem 
                    icon={item.icon} 
                    label={item.label} 
                    value={item.value} 
                    onClick={() => handleMenuClick(item.id)} 
                  />
                  {index < filteredSettings.length - 1 && <div className="h-[1px] bg-[#3A3A3C] mx-4" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === 4. Service List (서비스) === */}
        {filteredServices.length > 0 && (
          <div className="px-5 space-y-4 pb-4">
            <SectionTitle title="서비스" />
            <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
              {filteredServices.map((item, index) => (
                <div key={item.id}>
                  <ListItem 
                    icon={item.icon} 
                    label={item.label} 
                    value={item.value} 
                    onClick={() => handleMenuClick(item.id)}
                  />
                  {index < filteredServices.length - 1 && <div className="h-[1px] bg-[#3A3A3C] mx-4" />}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 검색 결과 없음 표시 */}
        {searchQuery && filteredSettings.length === 0 && filteredServices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-[#8E8E93]">
            <Search className="w-12 h-12 opacity-20 mb-3" />
            <p>검색 결과가 없습니다.</p>
          </div>
        )}

      </div>
    </div>
  );
}

// === [Sub Components] ===

function SectionTitle({ title }: { title: string }) {
  return <h3 className="text-sm font-bold text-[#E5E5EA] ml-1 mb-1">{title}</h3>;
}

function ListItem({ 
  icon, 
  label, 
  value, 
  onClick 
}: { 
  icon?: React.ReactNode; 
  label: string; 
  value?: string;
  onClick?: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group"
    >
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