import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, Smartphone, Laptop, MapPin, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

// === [Types] ===
interface Device {
  id: string;
  name: string;
  type: 'mobile' | 'desktop';
  location: string;
  lastLogin: string;
  isCurrent?: boolean;
}

// === [Mock Data] ===
const INITIAL_DEVICES: Device[] = [
  { id: '1', name: 'iPhone 15 Pro', type: 'mobile', location: '대한민국, 서울', lastLogin: '방금 전', isCurrent: true },
  { id: '2', name: 'MacBook Pro 16"', type: 'desktop', location: '대한민국, 판교', lastLogin: '2024.01.20 14:30', isCurrent: false },
  { id: '3', name: 'Galaxy Tab S9', type: 'mobile', location: '대한민국, 부산', lastLogin: '2023.12.25 09:12', isCurrent: false },
];

export default function DeviceManagementPage() {
  const navigate = useNavigate();

  // === States ===
  const [isNotifyEnabled, setIsNotifyEnabled] = useState(true); // 알림 토글
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES); // 기기 목록
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null); // 로그아웃 할 기기 ID
  const [isModalOpen, setIsModalOpen] = useState(false); // 모달 상태

  // === Handlers ===

  // 1. 알림 토글 핸들러
  const toggleNotification = () => {
    const newState = !isNotifyEnabled;
    setIsNotifyEnabled(newState);
    toast.success(newState ? '로그인 알림이 설정되었습니다.' : '로그인 알림이 해제되었습니다.');
  };

  // 2. 로그아웃 버튼 클릭 (모달 열기)
  const handleLogoutClick = (id: string) => {
    setSelectedDeviceId(id);
    setIsModalOpen(true);
  };

  // 3. 로그아웃 확인 (기기 삭제)
  const handleConfirmLogout = () => {
    if (selectedDeviceId) {
      setDevices(prev => prev.filter(d => d.id !== selectedDeviceId));
      toast.success('해당 기기에서 로그아웃 되었습니다.');
    }
    setIsModalOpen(false);
    setSelectedDeviceId(null);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* === Header === */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 text-white hover:text-brand-DEFAULT transition-colors"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">기기 연결 관리</h1>
      </header>

      {/* === Content === */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pt-4">
        <div className="px-5 space-y-8">
          
          {/* 1. Notification Toggle */}
          <div className="bg-[#2C2C2E] rounded-2xl p-5 flex items-center justify-between shadow-lg">
            <div>
              <h3 className="text-[15px] font-bold text-white mb-1">다른 기기에서 로그인 시 알림</h3>
              <p className="text-xs text-[#8E8E93]">새로운 기기 연결 시 푸시 알림을 받습니다.</p>
            </div>
            
            {/* ✨ [수정됨] Modern Spring Toggle Interaction */}
            <div 
              onClick={toggleNotification}
              className={`w-[52px] h-[32px] flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                isNotifyEnabled ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
              }`}
            >
              <motion.div
                className="w-6 h-6 bg-white rounded-full shadow-md"
                animate={{ x: isNotifyEnabled ? 20 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </div>
          </div>

          {/* 2. Device List */}
          <div>
            <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-3">로그인 된 기기</h3>
            
            {devices.length === 0 ? (
              <div className="py-10 text-center text-[#8E8E93] bg-[#2C2C2E] rounded-2xl">
                연결된 기기가 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {devices.map((device) => (
                    <motion.div
                      key={device.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="bg-[#2C2C2E] rounded-2xl p-5 border border-[#3A3A3C]"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${device.isCurrent ? 'bg-brand-DEFAULT/20 text-brand-DEFAULT' : 'bg-[#3A3A3C] text-[#8E8E93]'}`}>
                            {device.type === 'mobile' ? <Smartphone className="w-5 h-5" /> : <Laptop className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-[15px] font-bold text-white">{device.name}</h4>
                              {device.isCurrent && (
                                <span className="text-[10px] font-bold text-brand-DEFAULT bg-brand-DEFAULT/10 px-1.5 py-0.5 rounded">현재 기기</span>
                              )}
                            </div>
                            <p className="text-[11px] text-[#8E8E93] mt-0.5">{device.type === 'mobile' ? 'Mobile App' : 'PC Web'}</p>
                          </div>
                        </div>
                        {!device.isCurrent && (
                          <button 
                            onClick={() => handleLogoutClick(device.id)}
                            className="px-3 py-1.5 bg-[#3A3A3C] hover:bg-[#48484A] rounded-lg text-xs text-[#E5E5EA] transition-colors"
                          >
                            로그아웃
                          </button>
                        )}
                      </div>
                      
                      <div className="flex gap-4 pl-[52px]">
                        <div className="flex items-center gap-1.5 text-xs text-[#8E8E93]">
                          <MapPin className="w-3.5 h-3.5" />
                          {device.location}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[#8E8E93]">
                          <Clock className="w-3.5 h-3.5" />
                          {device.lastLogin}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* === Modal === */}
      <ConfirmLogoutModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmLogout}
      />

    </div>
  );
}

// === [Sub Component: Modal] ===
function ConfirmLogoutModal({ isOpen, onClose, onConfirm }: { isOpen: boolean; onClose: () => void; onConfirm: () => void }) {
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
        className="relative z-10 w-full max-w-[300px] bg-[#1C1C1E] rounded-2xl overflow-hidden shadow-2xl border border-[#2C2C2E] text-center"
      >
        <div className="p-6">
          <h3 className="text-white font-bold text-lg mb-2">기기 로그아웃</h3>
          <p className="text-[#8E8E93] text-sm">접속 중인 기기에서<br/>로그아웃 하시겠습니까?</p>
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
            className="flex-1 text-[#EC5022] font-bold text-[16px] hover:bg-[#2C2C2E] transition-colors"
          >
            확인
          </button>
        </div>
      </motion.div>
    </div>
  );
}