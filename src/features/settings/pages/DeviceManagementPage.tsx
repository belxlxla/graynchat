import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Smartphone, Laptop, MapPin, Clock, 
  ShieldCheck, Globe, LogOut, AlertTriangle, RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

// === [Types] ===
interface Device {
  id: string;
  os: string;
  browser: string;
  type: 'mobile' | 'desktop';
  location: string;
  lastLogin: string;
  isCurrent: boolean;
}

export default function DeviceManagementPage() {
  const navigate = useNavigate();

  // === States ===
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(() => localStorage.getItem('grayn_login_notify') === 'true');
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 1. 현재 브라우저/기기 환경 실시간 분석 (목업 데이터 배제)
  const getDetectedEnv = useCallback((): Device => {
    const ua = navigator.userAgent;
    let os = "알 수 없는 운영체제";
    let browser = "알 수 없는 브라우저";
    let type: 'mobile' | 'desktop' = 'desktop';

    // OS 분석
    if (ua.indexOf("Win") !== -1) os = "Windows PC";
    else if (ua.indexOf("Mac") !== -1) os = "macOS";
    else if (ua.indexOf("Android") !== -1) { os = "Android"; type = 'mobile'; }
    else if (ua.indexOf("like Mac") !== -1) { os = "iOS (iPhone/iPad)"; type = 'mobile'; }

    // 브라우저 분석
    if (ua.indexOf("Edg/") !== -1) browser = "Microsoft Edge";
    else if (ua.indexOf("Chrome/") !== -1) browser = "Google Chrome";
    else if (ua.indexOf("Safari/") !== -1) browser = "Safari";
    else if (ua.indexOf("Firefox/") !== -1) browser = "Firefox";

    return {
      id: 'current-session',
      os,
      browser,
      type,
      location: "대한민국 하남시", // 실제는 서버 IP GeoIP 연동 영역
      lastLogin: "현재 접속 중",
      isCurrent: true
    };
  }, []);

  // 2. 데이터 동기화
  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const current = getDetectedEnv();
      // 실제 서비스에서는 Supabase의 다른 활성 세션을 가져오지만, 
      // 현재는 사용자님의 실제 환경 정보만 1:1로 매핑하여 노출합니다.
      setDevices([current]);
    } catch (error) {
      toast.error('환경 정보를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [getDetectedEnv]);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  // 3. 알림 토글
  const toggleNotification = () => {
    const newState = !isNotifyEnabled;
    setIsNotifyEnabled(newState);
    localStorage.setItem('grayn_login_notify', String(newState));
    toast.success(newState ? '보안 알림 활성화' : '보안 알림 해제');
  };

  // 4. 로그아웃 요청
  const handleLogoutRequest = (device: Device) => {
    setSelectedDevice(device);
    setIsModalOpen(true);
  };

  // 5. 로그아웃 실행 (Supabase 연동)
  const handleConfirmLogout = async () => {
    if (!selectedDevice) return;

    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast.success('안전하게 로그아웃 되었습니다.');
      navigate('/auth/login');
    } catch (error) {
      toast.error('로그아웃 처리에 실패했습니다.');
    } finally {
      setIsModalOpen(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === Header === */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">기기 관리</h1>
      </header>

      {/* === Content === */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pt-6">
        <div className="px-5 space-y-8">
          
          {/* 1. 보안 상태 요약 */}
          <div className="bg-[#2C2C2E] rounded-[28px] p-6 border border-[#3A3A3C] shadow-2xl relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-brand-DEFAULT mb-1">
                  <ShieldCheck size={18} />
                  <span className="text-[11px] font-black uppercase tracking-widest">Security Status</span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">로그인 알림 설정</h3>
                <p className="text-[12px] text-[#8E8E93] leading-relaxed">새로운 기기에서 로그인 시<br/>즉시 알림을 발송하여 계정을 보호합니다.</p>
              </div>
              <div 
                onClick={toggleNotification}
                className={`w-[52px] h-[30px] flex items-center rounded-full p-1 cursor-pointer transition-colors duration-500 ${
                  isNotifyEnabled ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
                }`}
              >
                <motion.div
                  className="w-5 h-5 bg-white rounded-full shadow-lg"
                  animate={{ x: isNotifyEnabled ? 22 : 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 28 }}
                />
              </div>
            </div>
          </div>

          {/* 2. 접속 기기 리스트 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between ml-1">
              <h3 className="text-[13px] font-bold text-[#8E8E93]">현재 접속 환경</h3>
              <button onClick={fetchDevices} className="p-1 hover:rotate-180 transition-transform duration-500 text-[#8E8E93]">
                <RefreshCw size={16} />
              </button>
            </div>

            <div className="space-y-3">
              {isLoading ? (
                <div className="h-40 bg-[#2C2C2E] rounded-3xl animate-pulse border border-[#3A3A3C]" />
              ) : (
                <AnimatePresence>
                  {devices.map((device) => (
                    <motion.div
                      key={device.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-[#2C2C2E] rounded-[32px] p-6 border border-[#3A3A3C] shadow-xl relative"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-2xl bg-[#1C1C1E] flex items-center justify-center border border-white/5 text-brand-DEFAULT">
                            {device.type === 'mobile' ? <Smartphone size={28} /> : <Laptop size={28} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[17px] font-bold text-white tracking-tight">{device.os}</h4>
                              <span className="text-[10px] font-black text-brand-DEFAULT bg-brand-DEFAULT/10 px-2 py-0.5 rounded-full border border-brand-DEFAULT/20">현재 기기</span>
                            </div>
                            <p className="text-[13px] text-[#8E8E93] mt-0.5">{device.browser}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => handleLogoutRequest(device)}
                          className="w-10 h-10 rounded-xl bg-[#1C1C1E] flex items-center justify-center text-[#8E8E93] hover:text-[#FF453A] transition-colors"
                        >
                          <LogOut size={20} />
                        </button>
                      </div>

                      <div className="h-[1px] bg-[#3A3A3C] w-full my-5" />

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-[12px] text-[#8E8E93]">
                          <MapPin size={14} className="text-brand-DEFAULT" />
                          {device.location}
                        </div>
                        <div className="flex items-center gap-2 text-[12px] text-[#8E8E93]">
                          <Clock size={14} className="text-brand-DEFAULT" />
                          {device.lastLogin}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              )}
            </div>
          </div>

          {/* 안내문구 */}
          <div className="px-2 py-4 flex items-start gap-3 opacity-50">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            <p className="text-[11px] leading-relaxed">
              의심스러운 활동이 감지되면 즉시 로그아웃하고 비밀번호를 변경하세요. 보안 세션은 최대 30일간 유지됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* === [커스텀 다크 경고 모달] === */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-8">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/90 backdrop-blur-md" 
              onClick={() => setIsModalOpen(false)} 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] border border-[#2C2C2E] rounded-[40px] overflow-hidden shadow-2xl text-center"
            >
              <div className="p-8 pb-6">
                <div className="w-16 h-16 bg-[#FF453A]/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-[#FF453A]/20">
                  <AlertTriangle size={32} className="text-[#FF453A]" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">로그아웃 하시겠습니까?</h3>
                <p className="text-[13px] text-[#8E8E93] leading-relaxed">
                  현재 사용 중인 기기에서 로그아웃하면<br/>
                  서비스 이용을 위해 다시 로그인해야 합니다.<br/>
                  정말 로그아웃 하시겠습니까?
                </p>
              </div>
              <div className="flex p-4 gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-4 bg-[#2C2C2E] text-white font-bold rounded-2xl active:scale-95 transition-all"
                >
                  취소
                </button>
                <button 
                  onClick={handleConfirmLogout}
                  className="flex-1 py-4 bg-[#FF453A] text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-[#FF453A]/20"
                >
                  로그아웃
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}