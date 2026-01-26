import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Settings, MapPin, Cloud, Sun, CloudRain, 
  Snowflake, Wallet, Gift, ShoppingBag, Music, 
  HelpCircle, Megaphone, ChevronRight, RefreshCw, Smartphone,
  CloudLightning, CloudFog, CloudDrizzle, Moon // Wind 제거됨
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

// === [Mock Data] ===
const MOCK_BANNERS: Banner[] = [
  { id: 1, imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?q=80&w=1000&auto=format&fit=crop', link: '#', title: '그레인 멤버십 혜택 모아보기' },
  { id: 2, imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1000&auto=format&fit=crop', link: '#', title: '이번 달 인기 이모티콘 할인' },
  { id: 3, imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=1000&auto=format&fit=crop', link: '#', title: '친구 초대하고 포인트 받자!' },
];

export default function SettingsPage() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);

  useEffect(() => { loadWeather(); }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % MOCK_BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

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
      {
        enableHighAccuracy: true, 
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const getWeatherDisplay = (code: number, isDay: boolean) => {
    if (code === 0) return { 
      icon: isDay ? <Sun className="w-10 h-10 text-orange-400 drop-shadow-lg" /> : <Moon className="w-10 h-10 text-yellow-200 drop-shadow-lg" />, 
      text: '맑음',
      bg: isDay ? 'from-blue-400/20 to-blue-600/20' : 'from-slate-800 to-slate-900'
    };
    if (code >= 1 && code <= 3) return { 
      icon: <Cloud className="w-10 h-10 text-gray-300 drop-shadow-lg" />, 
      text: code === 1 ? '대체로 맑음' : '흐림',
      bg: 'from-gray-400/20 to-gray-600/20'
    };
    if (code >= 45 && code <= 48) return { 
      icon: <CloudFog className="w-10 h-10 text-slate-400 drop-shadow-lg" />, 
      text: '안개',
      bg: 'from-slate-500/20 to-slate-700/20'
    };
    if (code >= 51 && code <= 67) return { 
      icon: <CloudDrizzle className="w-10 h-10 text-blue-300 drop-shadow-lg" />, 
      text: '비',
      bg: 'from-blue-500/30 to-blue-800/30'
    };
    if (code >= 71 && code <= 77) return { 
      icon: <Snowflake className="w-10 h-10 text-white drop-shadow-lg" />, 
      text: '눈',
      bg: 'from-sky-300/20 to-sky-600/20'
    };
    if (code >= 80 && code <= 82) return { 
      icon: <CloudRain className="w-10 h-10 text-blue-400 drop-shadow-lg" />, 
      text: '소나기',
      bg: 'from-indigo-400/20 to-indigo-800/20'
    };
    if (code >= 95) return { 
      icon: <CloudLightning className="w-10 h-10 text-yellow-400 drop-shadow-lg" />, 
      text: '뇌우',
      bg: 'from-purple-500/20 to-purple-900/20'
    };

    return { 
      icon: <Sun className="w-10 h-10 text-orange-400" />, 
      text: '맑음',
      bg: 'from-gray-700/20 to-gray-900/20'
    };
  };

  return (
    <div className="w-full h-full flex flex-col bg-dark-bg text-white pb-4">
      <header className="h-14 px-4 flex items-center justify-between bg-dark-bg sticky top-0 z-10 shrink-0">
        <h1 className="text-xl font-bold ml-1">더보기</h1>
        <div className="flex gap-1">
          <button className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
            <Search className="w-6 h-6" />
          </button>
          <button onClick={() => toast('앱 설정 (준비중)')} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors mb-2">
          <div className="w-[52px] h-[52px] rounded-[20px] bg-[#3A3A3C] overflow-hidden border border-[#2C2C2E]">
            <img src="https://i.pravatar.cc/150?u=me" alt="Me" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <h2 className="text-[17px] font-bold">나 (임정민)</h2>
            <p className="text-xs text-[#8E8E93] mt-0.5">grayn@email.com</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#636366]" />
        </div>

        <div className="px-5 mb-6">
          <div className="relative w-full h-[90px] rounded-2xl overflow-hidden border border-white/10 shadow-lg">
            {loadingWeather ? (
              <div className="w-full h-full bg-[#2C2C2E] flex items-center justify-center gap-2 text-[#8E8E93] text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> 날씨 정보를 불러오는 중...
              </div>
            ) : locationDenied ? (
              <button 
                onClick={loadWeather} 
                className="w-full h-full bg-[#2C2C2E] flex flex-col items-center justify-center gap-1 hover:bg-[#3A3A3C] transition-colors"
              >
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
                    <div className="z-10 scale-110">
                      {display.icon}
                    </div>
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

        <div className="px-3 mb-8">
          <div className="grid grid-cols-4 gap-y-6">
            <MenuIcon icon={<Wallet className="w-6 h-6" />} label="지갑" />
            <MenuIcon icon={<Gift className="w-6 h-6" />} label="선물하기" />
            <MenuIcon icon={<ShoppingBag className="w-6 h-6" />} label="쇼핑" />
            <MenuIcon icon={<Music className="w-6 h-6" />} label="뮤직" />
            <MenuIcon icon={<Smartphone className="w-6 h-6" />} label="그레인콘" />
            <MenuIcon icon={<Cloud className="w-6 h-6" />} label="톡서랍" />
            <MenuIcon icon={<Megaphone className="w-6 h-6" />} label="공지사항" />
            <MenuIcon icon={<HelpCircle className="w-6 h-6" />} label="고객센터" />
          </div>
        </div>

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
              <p className="text-[13px] font-bold text-white drop-shadow-md line-clamp-1">
                {MOCK_BANNERS[currentBanner].title}
              </p>
            </div>

            <div className="absolute bottom-3 right-3 flex gap-1.5 bg-black/20 px-2 py-1 rounded-full backdrop-blur-sm">
              {MOCK_BANNERS.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === currentBanner ? 'bg-white w-3' : 'bg-white/40'}`} 
                />
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 space-y-4 pb-10">
          <SectionTitle title="서비스" />
          <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
            <ListItem label="캘린더" />
            <div className="h-[1px] bg-[#3A3A3C] mx-4" />
            <ListItem label="서랍" />
            <div className="h-[1px] bg-[#3A3A3C] mx-4" />
            <ListItem label="메이커스" />
            <div className="h-[1px] bg-[#3A3A3C] mx-4" />
            <ListItem label="전체 서비스 보기" isLink />
          </div>
        </div>

      </div>
    </div>
  );
}

function MenuIcon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button className="flex flex-col items-center gap-2 group cursor-pointer">
      <div className="w-12 h-12 flex items-center justify-center rounded-2xl text-[#E5E5EA] group-hover:bg-[#2C2C2E] group-active:scale-95 transition-all">
        {icon}
      </div>
      <span className="text-[11px] text-[#8E8E93] group-hover:text-white transition-colors">{label}</span>
    </button>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="text-sm font-bold text-[#E5E5EA] ml-1">{title}</h3>;
}

function ListItem({ label, isLink }: { label: string; isLink?: boolean }) {
  return (
    <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group">
      <span className={`text-[15px] ${isLink ? 'text-[#8E8E93] font-medium' : 'text-white'}`}>{label}</span>
      <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
    </button>
  );
}