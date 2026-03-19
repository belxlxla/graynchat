import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Bell, MessageSquare, Volume2, 
  Moon, Sparkles, Clock, ChevronRight, ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';
import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { NativeSettings } from 'capacitor-native-settings';

export default function NotificationSettingsPage() {
  const navigate = useNavigate();

  const [settings, setSettings] = useState({
    all: true,
    preview: true,
    sound: true,
    vibrate: true,
    mention: true, 
    dnd: false,
  });

  const [dndTime, setDndTime] = useState({ start: '22:00', end: '08:00' });
  const [showDndPicker, setShowDndPicker] = useState(false);
  const [nativePermission, setNativePermission] = useState<string>('default');

  // 네이티브 권한 상태 확인
  const checkNativePermission = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      const status = await PushNotifications.checkPermissions();
      setNativePermission(status.receive);
    } catch (err) {
      console.error('권한 확인 실패:', err);
    }
  }, []);

  useEffect(() => {
    checkNativePermission();
  }, [checkNativePermission]);

  // 설정 불러오기
  const fetchSettings = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data } = await supabase
      .from('user_settings')
      .select('notify_all, notify_preview, notify_mention, notify_sound, notify_vibrate, dnd_enabled, dnd_start, dnd_end')
      .eq('user_id', session.user.id)
      .maybeSingle();

    if (data) {
      setSettings({
        all: data.notify_all ?? true,
        preview: data.notify_preview ?? true,
        mention: data.notify_mention ?? true,
        sound: data.notify_sound ?? true,
        vibrate: data.notify_vibrate ?? true,
        dnd: data.dnd_enabled ?? false,
      });
      if (data.dnd_start && data.dnd_end) {
        setDndTime({ 
          start: data.dnd_start.slice(0, 5), 
          end: data.dnd_end.slice(0, 5) 
        });
      }
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 네이티브 알림 권한 요청
  const requestNativePermission = async () => {
    if (!Capacitor.isNativePlatform()) return;
    
    try {
      const status = await PushNotifications.checkPermissions();
      
      if (status.receive === 'denied') {
        // 이미 거부된 경우 → 설정 앱으로 이동
        toast('설정 앱에서 알림을 허용해주세요.', { icon: '⚙️' });
        await openAppSettings();
        return;
      }

      if (status.receive === 'prompt' || status.receive === 'prompt-with-rationale') {
        const result = await PushNotifications.requestPermissions();
        setNativePermission(result.receive);
        
        if (result.receive === 'granted') {
          await PushNotifications.register();
          toast.success('알림이 활성화되었습니다!');
          
          // notify_all도 true로 업데이트
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            await supabase.from('user_settings').upsert({
              user_id: session.user.id,
              notify_all: true,
            }, { onConflict: 'user_id' });
            setSettings(prev => ({ ...prev, all: true }));
          }
        } else {
          toast.error('알림 권한이 거부되었습니다.');
        }
      } else if (status.receive === 'granted') {
        await PushNotifications.register();
        toast.success('알림이 이미 활성화되어 있습니다.');
      }
    } catch (err) {
      console.error('권한 요청 실패:', err);
      toast.error('권한 요청 중 오류가 발생했습니다.');
    }
  };

  // 설정 앱 열기
const openAppSettings = async () => {
  try {
    if (Capacitor.isNativePlatform()) {
      await NativeSettings.open({
        optionIOS: 'app',
        optionAndroid: 'application_details', 
      });
    }
  } catch (err) {
    console.error('설정 앱 열기 실패:', err);
    toast.error('설정 앱을 열 수 없습니다.');
  }
};

  // 설정 변경
  const handleToggle = async (key: keyof typeof settings) => {
    // 알림 전체를 켜려는데 권한이 없으면 권한 요청
    if (key === 'all' && !settings.all && nativePermission !== 'granted') {
      await requestNativePermission();
      return;
    }

    let newSettings = { ...settings, [key]: !settings[key] };

    if (key === 'all') {
      const targetState = !settings.all;
      newSettings = {
        all: targetState,
        preview: targetState,
        mention: targetState,
        sound: targetState,
        vibrate: targetState,
        dnd: settings.dnd,
      };
    }

    setSettings(newSettings);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase.from('user_settings').upsert({
      user_id: session.user.id,
      notify_all: newSettings.all,
      notify_preview: newSettings.preview,
      notify_mention: newSettings.mention,
      notify_sound: newSettings.sound,
      notify_vibrate: newSettings.vibrate,
      dnd_enabled: newSettings.dnd,
    }, { onConflict: 'user_id' });

    if (error) {
      toast.error('설정 저장에 실패했습니다.');
      fetchSettings();
    }
  };

  // 방해금지 시간 저장
  const saveDndTime = async (newTime: typeof dndTime) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase.from('user_settings').upsert({
      user_id: session.user.id,
      dnd_start: `${newTime.start}:00`,
      dnd_end: `${newTime.end}:00`,
    }, { onConflict: 'user_id' });

    if (!error) {
      setDndTime(newTime);
      toast.success('방해금지 시간이 설정되었습니다.');
    } else {
      toast.error('설정 저장에 실패했습니다.');
    }
  };

  const isPermissionDenied = Capacitor.isNativePlatform() && nativePermission === 'denied';
  const isPermissionGranted = !Capacitor.isNativePlatform() || nativePermission === 'granted';

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden" 
      style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">알림 설정</h1>
      </header>

      <div className="flex-1 overflow-y-auto pb-10 pt-4">
        <div className="px-5 space-y-6">

          {/* 권한 거부된 경우 배너 */}
          {isPermissionDenied && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-[20px] p-4">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-red-400 mb-1">알림 권한이 거부되었습니다</h4>
                  <p className="text-xs text-[#8E8E93] mb-3">
                    푸시 알림을 받으려면 설정에서 직접 허용해야 해요.
                  </p>
                  <button
                    onClick={openAppSettings}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-bold rounded-xl text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    설정 앱에서 허용하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 권한 없는 경우 배너 */}
          {!isPermissionGranted && !isPermissionDenied && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-[20px] p-4">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-yellow-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-yellow-500 mb-1">알림 권한 필요</h4>
                  <p className="text-xs text-[#8E8E93] mb-3">
                    앱이 꺼져있을 때도 메시지를 받으려면 권한이 필요해요.
                  </p>
                  <button
                    onClick={requestNativePermission}
                    className="px-4 py-2 bg-yellow-500 text-black font-bold rounded-xl text-sm"
                  >
                    권한 허용하기
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 전체 알림 토글 */}
          <div className="bg-[#2C2C2E] rounded-[24px] p-5 border border-[#3A3A3C]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-brand-DEFAULT/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-brand-DEFAULT" />
                </div>
                <div>
                  <h3 className="text-[15px] font-bold">전체 알림</h3>
                  <p className="text-[12px] text-[#8E8E93] mt-0.5">
                    {isPermissionGranted ? '알림이 활성화되어 있어요' : '권한을 먼저 허용해주세요'}
                  </p>
                </div>
              </div>
              <Switch 
                isOn={settings.all && isPermissionGranted} 
                onToggle={() => handleToggle('all')} 
              />
            </div>
          </div>

          {/* 메시지 알림 */}
          <Section title="메시지 알림">
            <ToggleItem 
              icon={<MessageSquare className="w-5 h-5" />}
              label="메시지 미리보기"
              desc="알림창에 메시지 내용 표시"
              isOn={settings.preview}
              onToggle={() => handleToggle('preview')}
              disabled={!settings.all || !isPermissionGranted}
            />
            <ToggleItem 
              icon={<Sparkles className="w-5 h-5" />}
              label="멘션 알림만 받기"
              desc="@멘션될 때만 알림 수신"
              isOn={settings.mention}
              onToggle={() => handleToggle('mention')}
              disabled={!settings.all || !isPermissionGranted}
            />
          </Section>

          {/* 소리 및 진동 */}
          <Section title="소리 및 진동">
            <ToggleItem 
              icon={<Volume2 className="w-5 h-5" />}
              label="알림음"
              isOn={settings.sound}
              onToggle={() => handleToggle('sound')}
              disabled={!settings.all || !isPermissionGranted}
            />
            <ToggleItem 
              icon={<SmartphoneIcon />}
              label="진동"
              isOn={settings.vibrate}
              onToggle={() => handleToggle('vibrate')}
              disabled={!settings.all || !isPermissionGranted}
            />
          </Section>

          {/* 방해금지 */}
          <Section title="방해금지">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5 text-[#8E8E93]" />
                <div>
                  <p className="text-[15px] text-white">방해금지 모드</p>
                  <p className="text-[12px] text-[#8E8E93] mt-0.5">설정 시간 동안 알림 차단</p>
                </div>
              </div>
              <Switch 
                isOn={settings.dnd} 
                onToggle={() => handleToggle('dnd')} 
              />
            </div>
            <button 
              onClick={() => setShowDndPicker(true)}
              disabled={!settings.dnd}
              className={`w-full flex items-center justify-between px-5 py-4 border-t border-[#3A3A3C] ${!settings.dnd ? 'opacity-30' : ''}`}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#8E8E93]" />
                <div className="text-left">
                  <p className="text-[15px] text-white">시간 설정</p>
                  <p className="text-[12px] text-brand-DEFAULT font-bold mt-0.5">
                    {dndTime.start} ~ {dndTime.end}
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#636366]" />
            </button>
          </Section>

          {/* 시스템 설정으로 이동 */}
          {Capacitor.isNativePlatform() && (
            <button
              onClick={openAppSettings}
              className="w-full flex items-center justify-between p-4 bg-[#2C2C2E] rounded-[20px] border border-[#3A3A3C]"
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="w-5 h-5 text-[#8E8E93]" />
                <p className="text-[14px] text-white">시스템 알림 설정 열기</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#636366]" />
            </button>
          )}

        </div>
      </div>

      <AnimatePresence>
        {showDndPicker && (
          <DndPickerModal 
            time={dndTime} 
            onClose={() => setShowDndPicker(false)} 
            onSave={saveDndTime} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-bold text-[#636366] ml-2 uppercase tracking-widest">{title}</h4>
      <div className="bg-[#2C2C2E] rounded-[20px] overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C]">
        {children}
      </div>
    </div>
  );
}

function ToggleItem({ icon, label, desc, isOn, onToggle, disabled }: any) {
  return (
    <div className={`p-4 flex items-center justify-between ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="text-[#8E8E93]">{icon}</div>
        <div>
          <p className="text-[14px] text-white">{label}</p>
          {desc && <p className="text-[11px] text-[#8E8E93] mt-0.5">{desc}</p>}
        </div>
      </div>
      <Switch isOn={isOn} onToggle={onToggle} />
    </div>
  );
}

function Switch({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  return (
    <div 
      onClick={onToggle}
      className={`w-[44px] h-[24px] flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${isOn ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'}`}
    >
      <motion.div 
        className="w-4 h-4 bg-white rounded-full shadow-md" 
        animate={{ x: isOn ? 20 : 0 }} 
        transition={{ type: "spring", stiffness: 500, damping: 30 }} 
      />
    </div>
  );
}

function SmartphoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <path d="M12 18h.01" />
    </svg>
  );
}

function DndPickerModal({ time, onClose, onSave }: any) {
  const [tempTime, setTempTime] = useState(time);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-8">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.9, opacity: 0 }} 
        className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] rounded-[28px] border border-[#2C2C2E] overflow-hidden shadow-2xl">
        <div className="p-6">
          <h3 className="text-white font-bold text-lg mb-5 text-center">방해금지 시간 설정</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#8E8E93]">시작</span>
              <input type="time" value={tempTime.start} 
                onChange={(e) => setTempTime({ ...tempTime, start: e.target.value })} 
                className="bg-[#2C2C2E] text-white px-3 py-2 rounded-xl border border-[#3A3A3C] focus:outline-none" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#8E8E93]">종료</span>
              <input type="time" value={tempTime.end} 
                onChange={(e) => setTempTime({ ...tempTime, end: e.target.value })} 
                className="bg-[#2C2C2E] text-white px-3 py-2 rounded-xl border border-[#3A3A3C] focus:outline-none" />
            </div>
          </div>
        </div>
        <div className="flex border-t border-[#2C2C2E]">
          <button onClick={onClose} className="flex-1 py-4 text-[#8E8E93] font-bold border-r border-[#2C2C2E]">취소</button>
          <button onClick={() => { onSave(tempTime); onClose(); }} className="flex-1 py-4 text-brand-DEFAULT font-bold">저장</button>
        </div>
      </motion.div>
    </div>
  );
}