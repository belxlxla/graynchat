import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, MapPin, Cloud, Sun, CloudRain, 
  Snowflake, ChevronRight, RefreshCw, X,
  CloudLightning, CloudFog, CloudDrizzle, Moon,
  User, Lock, Users, Bell, Database, Monitor, Palette,
  Megaphone, Headphones, Info, Wind, Droplets, //Eye, 
  Gauge
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

const CURRENT_VERSION = '1.0.0'; 
const LATEST_VERSION = '1.0.0'; 

interface WeatherData {
  temp: number;
  code: number;
  location: string;
  isDay: boolean;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  uvIndex: number;
  visibility: number;
  pressure: number;
  hourly: Array<{
    time: string;
    temp: number;
    code: number;
  }>;
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

const MOCK_BANNERS: Banner[] = [
  { id: 1, imageUrl: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?q=80&w=1000&auto=format&fit=crop', link: '#', title: '그레인 멤버십 혜택 모아보기' },
  { id: 2, imageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=1000&auto=format&fit=crop', link: '#', title: '이번 달 인기 이모티콘 할인' },
  { id: 3, imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f7a07d?q=80&w=1000&auto=format&fit=crop', link: '#', title: '친구 초대하고 포인트 받자!' },
];

export default function SettingsPage() {
  const navigate = useNavigate();

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(0);

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [accountProvider, setAccountProvider] = useState('확인 중...');

  const isLatestVersion = CURRENT_VERSION === LATEST_VERSION;

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % MOCK_BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchUserProvider = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const user = session.user;
          let provider = 'email';
          
          if (user.user_metadata?.provider) {
            provider = user.user_metadata.provider;
          }
          else if (user.app_metadata?.provider) {
            provider = user.app_metadata.provider;
          }
          else if (user.email?.includes('@grayn.app')) {
            provider = 'naver';
          }
          else if (user.app_metadata?.providers && Array.isArray(user.app_metadata.providers)) {
            const providers = user.app_metadata.providers;
            if (providers.includes('google')) provider = 'google';
            else if (providers.includes('apple')) provider = 'apple';
            else if (providers.includes('naver')) provider = 'naver';
          }
          
          const providerMap: Record<string, string> = {
            'naver': '네이버 로그인',
            'google': '구글 로그인',
            'apple': '애플 로그인',
            'email': '이메일 로그인'
          };

          setAccountProvider(providerMap[provider] || '이메일 로그인');
        } else {
          setAccountProvider('이메일 로그인');
        }
      } catch (error) {
        console.error('Provider fetch error:', error);
        setAccountProvider('이메일 로그인');
      }
    };

    fetchUserProvider();
  }, []);

  useEffect(() => {
    const checkLocationPermission = async () => {
      const locationPermission = localStorage.getItem('grayn_location_permission');
      
      if (locationPermission === 'granted') {
        loadWeather();
      } else if (locationPermission === 'denied') {
        setLocationDenied(true);
      } else {
        requestLocationPermission();
      }
    };

    checkLocationPermission();
  }, []);

  const requestLocationPermission = () => {
    if (!navigator.geolocation) {
      toast.error('위치 정보를 사용할 수 없습니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        localStorage.setItem('grayn_location_permission', 'granted');
        setLocationDenied(false);
        loadWeather();
      },
      (error) => {
        console.error('위치 권한 거부:', error);
        if (error.code === 1) {
          localStorage.setItem('grayn_location_permission', 'denied');
          setLocationDenied(true);
          toast.error('위치 권한을 허용해주세요.');
        }
      }
    );
  };

  const handleMenuClick = (id: string) => {
    if (id === 'account') {
      navigate('/settings/account'); 
    } else if (id === 'privacy') {
      navigate('/settings/security');
    } else if (id === 'friend') {
      navigate('/settings/friends');
    } else if (id === 'noti') {
      navigate('/settings/notification');
    } else if (id === 'display') {
      navigate('/settings/display');
    } else if (id === 'theme') { // ✅ 테마 클릭 시 배경화면 설정 페이지로 이동
      navigate('/settings/display/wallpaper');
    } else if (id === 'backup') {
      toast('백업 기능은 준비 중입니다.');
    } else if (id === 'notice') {
      window.open('https://www.notion.so/GRAYN-2fbf8581f9c88074ad66eb5c5351db50?source=copy_link', '_blank'); 
    } else if (id === 'help') {
      navigate('/settings/help');
    } else if (id === 'version') {
      return; 
    } else {
      toast('준비 중인 기능입니다.');
    }
  };

  const handleUpdateApp = (e: React.MouseEvent) => {
    e.stopPropagation(); 
    
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.indexOf("android") > -1) {
      window.open("https://play.google.com/store/apps/details?id=com.vanishst.grain", "_blank");
    } else if (userAgent.indexOf("iphone") > -1 || userAgent.indexOf("ipad") > -1) {
      window.open("https://apps.apple.com/app/id123456789", "_blank");
    } else {
      toast('모바일 기기에서 스토어로 이동합니다.');
    }
  };

  // ✅ Open-Meteo API 사용 (완전 무료, API 키 불필요)
  const loadWeather = () => {
    if (!navigator.geolocation) {
      toast.error('위치 정보를 사용할 수 없습니다.');
      return;
    }

    setLoadingWeather(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocationDenied(false);
        
        try {
          // ✅ Open-Meteo API - 완전 무료, API 키 불필요
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,uv_index,is_day&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=1`
          );
          
          if (!weatherRes.ok) {
            throw new Error('날씨 API 요청 실패');
          }

          const weatherJson = await weatherRes.json();
          
          if (!weatherJson.current) {
            throw new Error('날씨 데이터를 불러올 수 없습니다.');
          }

          const current = weatherJson.current;
          const hourly = weatherJson.hourly;

          // 시간별 예보 데이터 (다음 12시간)
          const now = new Date();
          const currentHour = now.getHours();
          const hourlyData = hourly.time.slice(currentHour, currentHour + 12).map((time: string, index: number) => ({
            time: new Date(time).getHours() + '시',
            temp: Math.round(hourly.temperature_2m[currentHour + index]),
            code: hourly.weather_code[currentHour + index]
          }));

          // 위치 이름 가져오기 (역지오코딩)
          const geoRes = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ko`
          );
          const geoJson = await geoRes.json();
          const locationName = geoJson.locality || geoJson.city || geoJson.principalSubdivision || '현재 위치';

          setWeather({
            temp: Math.round(current.temperature_2m),
            code: current.weather_code,
            isDay: current.is_day === 1,
            location: locationName,
            feelsLike: Math.round(current.apparent_temperature),
            humidity: Math.round(current.relative_humidity_2m),
            windSpeed: Math.round(current.wind_speed_10m * 3.6), // m/s to km/h
            precipitation: Math.round(current.precipitation || 0),
            uvIndex: Math.round(current.uv_index || 0),
            visibility: 10, // Open-Meteo 무료 플랜에서는 시정 미제공
            pressure: Math.round(current.surface_pressure),
            hourly: hourlyData
          });

        } catch (e) {
          console.error('날씨 로드 에러:', e);
          toast.error('날씨 정보를 불러오는데 실패했습니다.');
        } finally {
          setLoadingWeather(false);
        }
      },
      (error) => {
        console.error("위치 오류:", error);
        setLoadingWeather(false);
        setLocationDenied(true);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  // ✅ WMO Weather Code 매핑 (Open-Meteo 표준)
  const getWeatherDisplay = (code: number, isDay: boolean) => {
    // Clear sky (0)
    if (code === 0) {
      return { 
        icon: isDay ? <Sun className="w-10 h-10 text-yellow-400" /> : <Moon className="w-10 h-10 text-yellow-200" />, 
        text: '맑음', 
        bg: isDay 
          ? 'from-blue-400/40 via-cyan-400/30 to-blue-500/40' 
          : 'from-indigo-900/50 via-blue-900/50 to-gray-900/50',
        emoji: isDay ? '☀️' : '🌙'
      };
    }
    // Mainly clear, partly cloudy (1, 2, 3)
    if (code >= 1 && code <= 3) {
      const text = code === 1 ? '대체로 맑음' : code === 2 ? '구름 조금' : '구름 많음';
      return { 
        icon: <Cloud className="w-10 h-10 text-gray-300" />, 
        text, 
        bg: 'from-gray-500/30 via-gray-600/30 to-gray-700/30',
        emoji: '☁️'
      };
    }
    // Fog (45, 48)
    if (code === 45 || code === 48) {
      return { 
        icon: <CloudFog className="w-10 h-10 text-gray-300" />, 
        text: '안개', 
        bg: 'from-gray-400/30 via-gray-500/30 to-gray-600/30',
        emoji: '🌫️'
      };
    }
    // Drizzle (51, 53, 55)
    if (code >= 51 && code <= 55) {
      return { 
        icon: <CloudDrizzle className="w-10 h-10 text-blue-300" />, 
        text: '이슬비', 
        bg: 'from-blue-400/30 via-gray-600/30 to-gray-800/30',
        emoji: '🌧️'
      };
    }
    // Rain (61, 63, 65, 80, 81, 82)
    if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) {
      const text = code >= 80 ? '소나기' : '비';
      return { 
        icon: <CloudRain className="w-10 h-10 text-blue-400" />, 
        text, 
        bg: 'from-blue-500/35 via-blue-700/35 to-gray-900/35',
        emoji: '🌧️'
      };
    }
    // Snow (71, 73, 75, 77, 85, 86)
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
      return { 
        icon: <Snowflake className="w-10 h-10 text-blue-100" />, 
        text: '눈', 
        bg: 'from-blue-200/25 via-blue-300/25 to-blue-400/25',
        emoji: '❄️'
      };
    }
    // Thunderstorm (95, 96, 99)
    if (code >= 95) {
      return { 
        icon: <CloudLightning className="w-10 h-10 text-yellow-300" />, 
        text: '뇌우', 
        bg: 'from-purple-900/40 via-gray-800/40 to-gray-900/40',
        emoji: '⛈️'
      };
    }

    return { 
      icon: <Sun className="w-10 h-10 text-yellow-400" />, 
      text: '맑음', 
      bg: 'from-blue-400/40 to-blue-600/40',
      emoji: '☀️'
    };
  };

  const getHourlyWeatherIcon = (code: number) => {
    if (code === 0) return '☀️';
    if (code >= 1 && code <= 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌧️';
    if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return '🌧️';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄️';
    if (code >= 95) return '⛈️';
    return '☀️';
  };

  const settingsItems: MenuItem[] = [
    { id: 'account', label: '그레인 계정정보', icon: <User className="w-5 h-5 text-[#8E8E93]" />, value: accountProvider },
    { id: 'privacy', label: '개인/보안', icon: <Lock className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'friend', label: '친구', icon: <Users className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'noti', label: '알림', icon: <Bell className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'backup', label: '백업', icon: <Database className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'display', label: '화면', icon: <Monitor className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'theme', label: '테마', icon: <Palette className="w-5 h-5 text-[#8E8E93]" /> },
  ];

  const serviceItems: MenuItem[] = [
    { id: 'notice', label: '공지사항', icon: <Megaphone className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'help', label: '그레인 고객센터/운영정책', icon: <Headphones className="w-5 h-5 text-[#8E8E93]" /> },
    { id: 'version', label: '앱 관리', icon: <Info className="w-5 h-5 text-[#8E8E93]" /> },
  ];

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
        
        {!searchQuery && (
          <div className="px-5 py-4">
            <div className="relative w-full rounded-[28px] overflow-hidden shadow-2xl">
              {loadingWeather ? (
                <div className="w-full h-[360px] bg-gradient-to-br from-blue-500/20 to-purple-600/20 backdrop-blur-xl flex items-center justify-center gap-2 text-white text-sm">
                  <RefreshCw className="w-5 h-5 animate-spin" /> 날씨 정보를 불러오는 중...
                </div>
              ) : locationDenied ? (
                <button 
                  onClick={() => {
                    localStorage.removeItem('grayn_location_permission');
                    requestLocationPermission();
                  }} 
                  className="w-full h-[360px] bg-gradient-to-br from-gray-700/30 to-gray-900/30 backdrop-blur-xl flex flex-col items-center justify-center gap-3 hover:from-gray-600/30 hover:to-gray-800/30 transition-all"
                >
                  <MapPin className="w-12 h-12 text-brand-DEFAULT" />
                  <div className="text-center">
                    <p className="text-white font-bold text-base mb-1">위치 정보 동의 필요</p>
                    <p className="text-xs text-white/70">탭하여 현재 날씨 확인하기</p>
                  </div>
                </button>
              ) : weather ? (
                (() => {
                  const display = getWeatherDisplay(weather.code, weather.isDay);
                  return (
                    <div className={`w-full min-h-[360px] bg-gradient-to-br ${display.bg} backdrop-blur-xl relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-black/20" />
                      <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                      <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/10 rounded-full blur-2xl" />
                      
                      <div className="relative z-10 p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-white/90" />
                            <span className="text-white/90 text-sm font-medium">{weather.location}</span>
                          </div>
                          <button 
                            onClick={loadWeather} 
                            className="p-2 hover:bg-white/10 rounded-full transition-colors"
                          >
                            <RefreshCw className="w-4 h-4 text-white/80" />
                          </button>
                        </div>

                        <div className="flex items-start justify-between mb-8">
                          <div>
                            <div className="flex items-baseline gap-1 mb-2">
                              <span className="text-7xl font-light text-white tracking-tight">{weather.temp}</span>
                              <span className="text-5xl font-light text-white/90">°</span>
                            </div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-2xl">{display.emoji}</span>
                              <span className="text-xl text-white/90 font-medium">{display.text}</span>
                            </div>
                            <p className="text-white/70 text-sm">체감 {weather.feelsLike}°</p>
                          </div>
                          <div className="mt-4">
                            {display.icon}
                          </div>
                        </div>

                        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-4">
                          <p className="text-white/80 text-xs font-medium mb-3 uppercase tracking-wide">시간별 예보</p>
                          <div className="flex gap-4 overflow-x-auto custom-scrollbar pb-2">
                            {weather.hourly.map((hour, index) => (
                              <div key={index} className="flex flex-col items-center gap-2 min-w-[50px]">
                                <span className="text-white/70 text-xs">{hour.time}</span>
                                <span className="text-2xl">{getHourlyWeatherIcon(hour.code)}</span>
                                <span className="text-white font-medium text-sm">{hour.temp}°</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3">
                          <WeatherDetail icon={<Wind className="w-4 h-4" />} label="바람" value={`${weather.windSpeed} km/h`} />
                          <WeatherDetail icon={<Droplets className="w-4 h-4" />} label="습도" value={`${weather.humidity}%`} />
                          <WeatherDetail icon={<Gauge className="w-4 h-4" />} label="기압" value={`${weather.pressure} hPa`} />
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div className="w-full h-[360px] bg-gradient-to-br from-gray-700/30 to-gray-900/30 backdrop-blur-xl flex items-center justify-center text-sm text-white/70">
                  <button onClick={loadWeather} className="flex flex-col items-center gap-3 hover:text-white transition-colors">
                    <RefreshCw className="w-6 h-6" />
                    <span>날씨 불러오기</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

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
                    hideChevron={item.id === 'version'}
                    rightElement={
                      item.id === 'version' ? (
                        isLatestVersion ? (
                          <span className="text-[13px] text-[#8E8E93]">현재버전 {CURRENT_VERSION}</span>
                        ) : (
                          <button 
                            onClick={handleUpdateApp}
                            className="bg-brand-DEFAULT text-white text-[12px] font-bold px-3 py-1.5 rounded-full hover:bg-brand-hover transition-colors"
                          >
                            업데이트
                          </button>
                        )
                      ) : undefined
                    }
                    onClick={() => handleMenuClick(item.id)}
                  />
                  {index < filteredServices.length - 1 && <div className="h-[1px] bg-[#3A3A3C] mx-4" />}
                </div>
              ))}
            </div>
          </div>
        )}

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

function WeatherDetail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 flex flex-col items-center gap-1">
      <div className="text-white/70">{icon}</div>
      <span className="text-white/60 text-[10px] uppercase tracking-wide">{label}</span>
      <span className="text-white font-semibold text-sm">{value}</span>
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <h3 className="text-sm font-bold text-[#E5E5EA] ml-1 mb-1">{title}</h3>;
}

function ListItem({ 
  icon, 
  label, 
  value, 
  hideChevron, 
  rightElement, 
  onClick 
}: { 
  icon?: React.ReactNode; 
  label: string; 
  value?: string;
  hideChevron?: boolean;
  rightElement?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group ${!onClick ? 'cursor-default' : ''}`}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-[15px] text-white">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {value && <span className="text-[13px] text-[#8E8E93]">{value}</span>}
        {rightElement ? rightElement : (
          !hideChevron && <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
        )}
      </div>
    </button>
  );
}