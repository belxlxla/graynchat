import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, MapPin, Cloud, Sun, CloudRain,
  Snowflake, ChevronRight, RefreshCw, X,
  CloudLightning, CloudFog, CloudDrizzle, Moon,
  User, Lock, Users, Bell, Database, Monitor, Palette,
  Megaphone, Headphones, Info, Wind, Droplets,
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
  hourly: Array<{ time: string; temp: number; code: number }>;
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

  // ── 배너 자동 슬라이드 ─────────────────────────────────
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentBanner((prev) => (prev + 1) % MOCK_BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  // ── 로그인 제공자 조회 ─────────────────────────────────
  useEffect(() => {
    const fetchUserProvider = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const user = session.user;
          let provider = 'email';
          if (user.user_metadata?.provider) provider = user.user_metadata.provider;
          else if (user.app_metadata?.provider) provider = user.app_metadata.provider;
          else if (user.email?.includes('@grayn.app')) provider = 'naver';
          else if (user.app_metadata?.providers && Array.isArray(user.app_metadata.providers)) {
            const providers = user.app_metadata.providers;
            if (providers.includes('google')) provider = 'google';
            else if (providers.includes('apple')) provider = 'apple';
            else if (providers.includes('naver')) provider = 'naver';
          }
          const providerMap: Record<string, string> = {
            naver: '네이버 로그인', google: '구글 로그인',
            apple: '애플 로그인', email: '이메일 로그인',
          };
          setAccountProvider(providerMap[provider] || '이메일 로그인');
        } else {
          setAccountProvider('이메일 로그인');
        }
      } catch { setAccountProvider('이메일 로그인'); }
    };
    fetchUserProvider();
  }, []);

  // ── 위치 권한 확인 ─────────────────────────────────────
  useEffect(() => {
    const perm = localStorage.getItem('grayn_location_permission');
    if (perm === 'granted') loadWeather();
    else if (perm === 'denied') setLocationDenied(true);
    else requestLocationPermission();
  }, []);

  const requestLocationPermission = () => {
    if (!navigator.geolocation) { toast.error('위치 정보를 사용할 수 없습니다.'); return; }
    navigator.geolocation.getCurrentPosition(
      () => { localStorage.setItem('grayn_location_permission', 'granted'); setLocationDenied(false); loadWeather(); },
      (error) => {
        if (error.code === 1) { localStorage.setItem('grayn_location_permission', 'denied'); setLocationDenied(true); toast.error('위치 권한을 허용해주세요.'); }
      }
    );
  };

  const handleMenuClick = (id: string) => {
    if (id === 'account') navigate('/settings/account');
    else if (id === 'privacy') navigate('/settings/security');
    else if (id === 'friend') navigate('/settings/friends');
    else if (id === 'noti') navigate('/settings/notification');
    else if (id === 'display') navigate('/settings/display');
    else if (id === 'theme') navigate('/settings/display/wallpaper');
    else if (id === 'backup') toast('백업 기능은 준비 중입니다.');
    else if (id === 'notice') window.open('https://www.notion.so/GRAYN-2fbf8581f9c88074ad66eb5c5351db50?source=copy_link', '_blank');
    else if (id === 'help') navigate('/settings/help');
    else if (id === 'version') return;
    else toast('준비 중인 기능입니다.');
  };

  const handleUpdateApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) window.open('https://play.google.com/store/apps/details?id=com.vanishst.grain', '_blank');
    else if (ua.includes('iphone') || ua.includes('ipad')) window.open('https://apps.apple.com/app/id123456789', '_blank');
    else toast('모바일 기기에서 스토어로 이동합니다.');
  };

  // ── 날씨 로드 (Open-Meteo, 무료) ──────────────────────
  const loadWeather = () => {
    if (!navigator.geolocation) { toast.error('위치 정보를 사용할 수 없습니다.'); return; }
    setLoadingWeather(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setLocationDenied(false);
        try {
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,surface_pressure,wind_speed_10m,uv_index,is_day&hourly=temperature_2m,weather_code&timezone=auto&forecast_days=1`
          );
          if (!weatherRes.ok) throw new Error('날씨 API 요청 실패');
          const weatherJson = await weatherRes.json();
          if (!weatherJson.current) throw new Error('날씨 데이터를 불러올 수 없습니다.');
          const current = weatherJson.current;
          const hourly = weatherJson.hourly;
          const currentHour = new Date().getHours();
          const hourlyData = hourly.time.slice(currentHour, currentHour + 12).map((time: string, index: number) => ({
            time: new Date(time).getHours() + '시',
            temp: Math.round(hourly.temperature_2m[currentHour + index]),
            code: hourly.weather_code[currentHour + index],
          }));
          const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=ko`);
          const geoJson = await geoRes.json();
          const locationName = geoJson.locality || geoJson.city || geoJson.principalSubdivision || '현재 위치';
          setWeather({
            temp: Math.round(current.temperature_2m),
            code: current.weather_code,
            isDay: current.is_day === 1,
            location: locationName,
            feelsLike: Math.round(current.apparent_temperature),
            humidity: Math.round(current.relative_humidity_2m),
            windSpeed: Math.round(current.wind_speed_10m * 3.6),
            precipitation: Math.round(current.precipitation || 0),
            uvIndex: Math.round(current.uv_index || 0),
            visibility: 10,
            pressure: Math.round(current.surface_pressure),
            hourly: hourlyData,
          });
        } catch (e) { console.error('날씨 로드 에러:', e); toast.error('날씨 정보를 불러오는데 실패했습니다.'); }
        finally { setLoadingWeather(false); }
      },
      (error) => { console.error('위치 오류:', error); setLoadingWeather(false); setLocationDenied(true); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  // ── WMO Weather Code 매핑 ──────────────────────────────
  const getWeatherDisplay = (code: number, isDay: boolean) => {
    if (code === 0) return { icon: isDay ? <Sun className="w-9 h-9" style={{ color: '#FCC419' }} /> : <Moon className="w-9 h-9" style={{ color: '#CBD5E1' }} />, text: '맑음', emoji: isDay ? '☀️' : '🌙' };
    if (code >= 1 && code <= 3) return { icon: <Cloud className="w-9 h-9" style={{ color: '#94A3B8' }} />, text: code === 1 ? '대체로 맑음' : code === 2 ? '구름 조금' : '구름 많음', emoji: '☁️' };
    if (code === 45 || code === 48) return { icon: <CloudFog className="w-9 h-9" style={{ color: '#94A3B8' }} />, text: '안개', emoji: '🌫️' };
    if (code >= 51 && code <= 55) return { icon: <CloudDrizzle className="w-9 h-9" style={{ color: '#93C5FD' }} />, text: '이슬비', emoji: '🌦️' };
    if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return { icon: <CloudRain className="w-9 h-9" style={{ color: '#60A5FA' }} />, text: code >= 80 ? '소나기' : '비', emoji: '🌧️' };
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: <Snowflake className="w-9 h-9" style={{ color: '#BAE6FD' }} />, text: '눈', emoji: '❄️' };
    if (code >= 95) return { icon: <CloudLightning className="w-9 h-9" style={{ color: '#FDE047' }} />, text: '뇌우', emoji: '⛈️' };
    return { icon: <Sun className="w-9 h-9" style={{ color: '#FCC419' }} />, text: '맑음', emoji: '☀️' };
  };

  const getHourlyWeatherIcon = (code: number) => {
    if (code === 0) return '☀️';
    if (code >= 1 && code <= 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 51 && code <= 55) return '🌦️';
    if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return '🌧️';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '❄️';
    if (code >= 95) return '⛈️';
    return '☀️';
  };

  const settingsItems: MenuItem[] = [
    { id: 'account', label: '그레인 계정정보', icon: <User className="w-[18px] h-[18px]" />, value: accountProvider },
    { id: 'privacy', label: '개인/보안', icon: <Lock className="w-[18px] h-[18px]" /> },
    { id: 'friend', label: '친구', icon: <Users className="w-[18px] h-[18px]" /> },
    { id: 'noti', label: '알림', icon: <Bell className="w-[18px] h-[18px]" /> },
    { id: 'backup', label: '백업', icon: <Database className="w-[18px] h-[18px]" /> },
    { id: 'display', label: '화면', icon: <Monitor className="w-[18px] h-[18px]" /> },
    { id: 'theme', label: '테마', icon: <Palette className="w-[18px] h-[18px]" /> },
  ];

  const serviceItems: MenuItem[] = [
    { id: 'notice', label: '공지사항', icon: <Megaphone className="w-[18px] h-[18px]" /> },
    { id: 'help', label: '고객센터 / 운영정책', icon: <Headphones className="w-[18px] h-[18px]" /> },
    { id: 'version', label: '앱 관리', icon: <Info className="w-[18px] h-[18px]" /> },
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
    <div className="w-full h-full flex flex-col bg-dark-bg text-white pb-24">

      {/* ── 헤더 ────────────────────────────────────────── */}
      <header className="h-14 px-4 flex items-center justify-between bg-dark-bg sticky top-0 z-10 shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <h1 className="text-[18px] font-bold tracking-tight">더보기</h1>
        <button
          onClick={() => { setIsSearching(!isSearching); if (isSearching) setSearchQuery(''); }}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
          style={{
            color: isSearching ? '#FF203A' : 'rgba(255,255,255,0.5)',
            background: isSearching ? 'rgba(255,32,58,0.08)' : 'transparent',
          }}
        >
          {isSearching ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
        </button>
      </header>

      {/* ── 검색창 ──────────────────────────────────────── */}
      <AnimatePresence>
        {isSearching && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden px-4 shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="py-2.5">
              <div className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <Search className="w-3.5 h-3.5 shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
                <input
                  type="text"
                  placeholder="설정 메뉴 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-[13px] w-full focus:outline-none placeholder-white/20"
                  style={{ color: 'rgba(255,255,255,0.82)' }}
                  autoFocus
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}>
                    <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto pb-8" style={{ scrollbarWidth: 'none' }}>

        {/* ── 날씨 위젯 ──────────────────────────────────── */}
        {!searchQuery && (
          <div className="px-4 pt-4 pb-3">
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>

              {loadingWeather && (
                <div className="h-[280px] flex items-center justify-center gap-2.5"
                  style={{ color: 'rgba(255,255,255,0.3)' }}>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-[13px]">날씨 정보를 불러오는 중</span>
                </div>
              )}

              {!loadingWeather && locationDenied && (
                <button
                  onClick={() => { localStorage.removeItem('grayn_location_permission'); requestLocationPermission(); }}
                  className="w-full h-[180px] flex flex-col items-center justify-center gap-3 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.35)' }}
                >
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(255,32,58,0.08)', border: '1px solid rgba(255,32,58,0.15)' }}>
                    <MapPin className="w-5 h-5" style={{ color: '#FF203A' }} />
                  </div>
                  <div className="text-center">
                    <p className="text-[13px] font-medium text-white/60 mb-0.5">위치 정보 동의 필요</p>
                    <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>탭하여 현재 날씨 확인하기</p>
                  </div>
                </button>
              )}

              {!loadingWeather && !locationDenied && !weather && (
                <button
                  onClick={loadWeather}
                  className="w-full h-[180px] flex flex-col items-center justify-center gap-3 transition-colors"
                  style={{ color: 'rgba(255,255,255,0.3)' }}
                >
                  <RefreshCw className="w-5 h-5" />
                  <span className="text-[13px]">날씨 불러오기</span>
                </button>
              )}

              {!loadingWeather && weather && (() => {
                const display = getWeatherDisplay(weather.code, weather.isDay);
                return (
                  <div className="p-5">
                    {/* 상단: 위치 + 새로고침 */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.3)' }} />
                        <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {weather.location}
                        </span>
                      </div>
                      <button
                        onClick={loadWeather}
                        className="w-7 h-7 flex items-center justify-center rounded-lg transition-colors"
                        style={{ color: 'rgba(255,255,255,0.25)' }}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 메인: 온도 + 아이콘 + 날씨 상태 */}
                    <div className="flex items-end justify-between mb-5">
                      <div>
                        <div className="flex items-start leading-none mb-2">
                          <span className="text-[64px] font-light tracking-tighter" style={{ color: 'rgba(255,255,255,0.92)', lineHeight: 1 }}>
                            {weather.temp}
                          </span>
                          <span className="text-[32px] font-light mt-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>°</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[15px]">{display.emoji}</span>
                          <span className="text-[14px] font-medium" style={{ color: 'rgba(255,255,255,0.65)' }}>
                            {display.text}
                          </span>
                          <span className="text-[12px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                            체감 {weather.feelsLike}°
                          </span>
                        </div>
                      </div>
                      <div className="mb-1">{display.icon}</div>
                    </div>

                    {/* 시간별 예보 */}
                    <div className="rounded-xl p-3.5 mb-3.5"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <p className="text-[10px] font-semibold mb-3 tracking-widest uppercase"
                        style={{ color: 'rgba(255,255,255,0.25)' }}>
                        시간별 예보
                      </p>
                      <div className="flex gap-3.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
                        {weather.hourly.map((hour, index) => (
                          <div key={index} className="flex flex-col items-center gap-1.5 shrink-0">
                            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                              {hour.time}
                            </span>
                            <span className="text-[15px]">{getHourlyWeatherIcon(hour.code)}</span>
                            <span className="text-[12px] font-medium" style={{ color: 'rgba(255,255,255,0.7)' }}>
                              {hour.temp}°
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 세부 정보 그리드 */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { icon: <Wind className="w-3.5 h-3.5" />, label: '바람', value: `${weather.windSpeed} km/h` },
                        { icon: <Droplets className="w-3.5 h-3.5" />, label: '습도', value: `${weather.humidity}%` },
                        { icon: <Gauge className="w-3.5 h-3.5" />, label: '기압', value: `${weather.pressure}` },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="rounded-xl p-3 flex flex-col items-center gap-1"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div style={{ color: 'rgba(255,255,255,0.3)' }}>{icon}</div>
                          <span className="text-[9px] tracking-widest uppercase"
                            style={{ color: 'rgba(255,255,255,0.22)' }}>{label}</span>
                          <span className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.72)' }}>
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── 배너 ─────────────────────────────────────── */}
        {!searchQuery && (
          <div className="px-4 pb-4">
            <div className="w-full aspect-[2.8/1] rounded-2xl overflow-hidden relative cursor-pointer"
              style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
              <AnimatePresence mode="wait">
                <motion.img
                  key={currentBanner}
                  src={MOCK_BANNERS[currentBanner].imageUrl}
                  alt="Banner"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.75 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="w-full h-full object-cover absolute inset-0"
                />
              </AnimatePresence>
              {/* 텍스트 오버레이 — 하단 솔리드 레이어 */}
              <div className="absolute bottom-0 left-0 right-0 px-4 py-3"
                style={{ background: 'rgba(0,0,0,0.55)' }}>
                <p className="text-[12px] font-semibold text-white truncate">
                  {MOCK_BANNERS[currentBanner].title}
                </p>
              </div>
              {/* 페이지 인디케이터 */}
              <div className="absolute top-2.5 right-3 flex gap-1">
                {MOCK_BANNERS.map((_, idx) => (
                  <div key={idx}
                    className="h-[3px] rounded-full transition-all duration-300"
                    style={{
                      width: idx === currentBanner ? 12 : 4,
                      background: idx === currentBanner ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── 설정 섹션 ────────────────────────────────── */}
        {filteredSettings.length > 0 && (
          <div className="px-4 pb-3">
            <SectionLabel>설정</SectionLabel>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
              {filteredSettings.map((item, index) => (
                <div key={item.id}>
                  <ListItem
                    icon={item.icon}
                    label={item.label}
                    value={item.value}
                    onClick={() => handleMenuClick(item.id)}
                  />
                  {index < filteredSettings.length - 1 && (
                    <div className="h-[1px] mx-4" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 서비스 섹션 ──────────────────────────────── */}
        {filteredServices.length > 0 && (
          <div className="px-4 pb-4">
            <SectionLabel>서비스</SectionLabel>
            <div className="rounded-2xl overflow-hidden"
              style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.07)' }}>
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
                          <span className="text-[11px] px-2.5 py-1 rounded-lg font-medium"
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              color: 'rgba(255,255,255,0.3)',
                              letterSpacing: '0.02em',
                            }}>
                            v{CURRENT_VERSION}
                          </span>
                        ) : (
                          <button
                            onClick={handleUpdateApp}
                            className="text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                            style={{ background: '#FF203A', color: 'white' }}
                          >
                            업데이트
                          </button>
                        )
                      ) : undefined
                    }
                    onClick={() => handleMenuClick(item.id)}
                  />
                  {index < filteredServices.length - 1 && (
                    <div className="h-[1px] mx-4" style={{ background: 'rgba(255,255,255,0.05)' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 검색 결과 없음 ────────────────────────────── */}
        {searchQuery && filteredSettings.length === 0 && filteredServices.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20"
            style={{ color: 'rgba(255,255,255,0.2)' }}>
            <Search className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-[13px]">검색 결과가 없습니다</p>
          </div>
        )}

      </div>
    </div>
  );
}

// ── 섹션 레이블 ─────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold px-1 mb-2 mt-1 tracking-[0.08em] uppercase"
      style={{ color: 'rgba(255,255,255,0.25)' }}>
      {children}
    </p>
  );
}

// ── 리스트 아이템 ────────────────────────────────────────
function ListItem({
  icon, label, value, hideChevron, rightElement, onClick,
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
      className={`w-full flex items-center justify-between px-4 py-3.5 transition-colors ${onClick ? 'active:bg-white/5' : 'cursor-default'}`}
    >
      <div className="flex items-center gap-3">
        {/* 아이콘 배경 박스 */}
        <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
          style={{
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.45)',
          }}>
          {icon}
        </div>
        <span className="text-[14px]" style={{ color: 'rgba(255,255,255,0.82)' }}>
          {label}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {value && (
          <span className="text-[12px] max-w-[120px] truncate"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            {value}
          </span>
        )}
        {rightElement
          ? rightElement
          : !hideChevron && (
            <ChevronRight className="w-3.5 h-3.5 shrink-0"
              style={{ color: 'rgba(255,255,255,0.2)' }} />
          )
        }
      </div>
    </button>
  );
}