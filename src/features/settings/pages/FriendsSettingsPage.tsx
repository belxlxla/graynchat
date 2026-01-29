import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Bell, MessageSquare, Volume2, 
  Moon, Sparkles, Clock, ChevronRight 
  // ✨ 에러 수정: 사용하지 않는 'X' 아이콘 임포트 제거됨
} from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../../shared/lib/supabaseClient';

export default function NotificationSettingsPage() {
  const navigate = useNavigate();

  // === States ===
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
  // ✨ 에러 수정: 사용하지 않는 'permission' 변수를 생략하고 setter만 유지
  const [, setPermission] = useState<NotificationPermission>('default');

  // 1. 초기 데이터 로드 및 권한 확인
  const fetchSettings = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // 브라우저 알림 권한 상태 체크
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    const { data, error } = await supabase
      .from('users')
      .select('notify_all, notify_preview, notify_mention, notify_sound, notify_vibrate, dnd_enabled, dnd_start, dnd_end')
      .eq('id', session.user.id)
      .single();

    if (!error && data) {
      setSettings({
        all: data.notify_all,
        preview: data.notify_preview,
        mention: data.notify_mention,
        sound: data.notify_sound,
        vibrate: data.notify_vibrate,
        dnd: data.dnd_enabled,
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

  // 2. 알림 권한 요청
  const requestPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        toast.success('알림 권한이 허용되었습니다.');
      }
    }
  };

  // 3. 설정 변경 핸들러 (수퍼베이스 실시간 동기화)
  const handleToggle = async (key: keyof typeof settings) => {
    let newSettings = { ...settings, [key]: !settings[key] };

    // 전체 알림 토글 시 하위 항목 일괄 변경
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
      if (targetState) await requestPermission();
    }

    setSettings(newSettings);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
      .from('users')
      .update({
        notify_all: newSettings.all,
        notify_preview: newSettings.preview,
        notify_mention: newSettings.mention,
        notify_sound: newSettings.sound,
        notify_vibrate: newSettings.vibrate,
        dnd_enabled: newSettings.dnd
      })
      .eq('id', session.user.id);

    if (error) {
      toast.error('설정 저장에 실패했습니다.');
      fetchSettings(); // 원복
    }
  };

  const saveDndTime = async (newTime: typeof dndTime) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { error } = await supabase
      .from('users')
      .update({
        dnd_start: `${newTime.start}:00`,
        dnd_end: `${newTime.end}:00`
      })
      .eq('id', session.user.id);

    if (!error) {
      setDndTime(newTime);
      toast.success('방해금지 시간이 설정되었습니다.');
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">알림 설정</h1>
      </header>

      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pt-4">
        <div className="px-5 space-y-8">
          
          <div className="bg-[#2C2C2E] rounded-[28px] p-6 border border-[#3A3A3C] shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-brand-DEFAULT/10 flex items-center justify-center text-brand-DEFAULT border border-brand-DEFAULT/20">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-[17px] font-bold">전체 알림 받기</h3>
                  <p className="text-[12px] text-[#8E8E93] mt-0.5">그레인의 모든 활동 알림을 제어합니다.</p>
                </div>
              </div>
              <Switch isOn={settings.all} onToggle={() => handleToggle('all')} />
            </div>
          </div>

          <Section title="메시지 알림">
            <ToggleItem 
              icon={<MessageSquare className="w-5 h-5" />}
              label="메시지 미리보기"
              desc="알림창에 메시지 내용을 표시합니다."
              isOn={settings.preview}
              onToggle={() => handleToggle('preview')}
              disabled={!settings.all}
            />
            <ToggleItem 
              icon={<Sparkles className="w-5 h-5" />}
              label="멘션 알림"
              desc="단톡방에서 멘션될 때만 알림을 받습니다."
              isOn={settings.mention}
              onToggle={() => handleToggle('mention')}
              disabled={!settings.all}
            />
          </Section>

          <Section title="소리 및 진동">
            <ToggleItem 
              icon={<Volume2 className="w-5 h-5" />}
              label="알림음"
              isOn={settings.sound}
              onToggle={() => handleToggle('sound')}
              disabled={!settings.all}
            />
            <ToggleItem 
              icon={<SmartphoneIcon />}
              label="진동"
              isOn={settings.vibrate}
              onToggle={() => {
                handleToggle('vibrate');
                if (!settings.vibrate && 'vibrate' in navigator) navigator.vibrate(200);
              }}
              disabled={!settings.all}
            />
          </Section>

          <Section title="기타">
            <div className="p-5 flex items-center justify-between">
              <div className="flex items-center gap-3 text-[#8E8E93]">
                <Moon className="w-5 h-5" />
                <span className="text-[15px] text-white">방해금지 모드</span>
              </div>
              <Switch isOn={settings.dnd} onToggle={() => handleToggle('dnd')} />
            </div>
            
            <button 
              onClick={() => setShowDndPicker(true)}
              disabled={!settings.dnd}
              className={`w-full flex items-center justify-between px-5 py-5 border-t border-[#3A3A3C] transition-colors ${!settings.dnd ? 'opacity-30' : 'hover:bg-[#3A3A3C]'}`}
            >
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-[#8E8E93]" />
                <div className="text-left">
                  <p className="text-[15px] text-white">방해금지 시간 설정</p>
                  <p className="text-[12px] text-brand-DEFAULT font-bold mt-0.5">{dndTime.start} ~ {dndTime.end}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-[#636366]" />
            </button>
          </Section>

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

// --- [Sub Components] ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-[11px] font-black text-[#636366] ml-2 uppercase tracking-widest">{title}</h4>
      <div className="bg-[#2C2C2E] rounded-[24px] overflow-hidden border border-[#3A3A3C] shadow-xl divide-y divide-[#3A3A3C]">
        {children}
      </div>
    </div>
  );
}

function ToggleItem({ icon, label, desc, isOn, onToggle, disabled }: any) {
  return (
    <div className={`p-5 flex items-center justify-between transition-opacity ${disabled ? 'opacity-30 pointer-events-none' : ''}`}>
      <div className="flex items-center gap-3">
        <div className="text-[#8E8E93]">{icon}</div>
        <div>
          <p className="text-[15px] text-white">{label}</p>
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
      <motion.div className="w-4 h-4 bg-white rounded-full shadow-md" animate={{ x: isOn ? 20 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] rounded-[32px] border border-[#2C2C2E] overflow-hidden shadow-2xl">
        <div className="p-8">
          <h3 className="text-white font-bold text-lg mb-6 text-center">방해금지 시간 설정</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#8E8E93]">시작 시간</span>
              <input type="time" value={tempTime.start} onChange={(e) => setTempTime({ ...tempTime, start: e.target.value })} className="bg-[#2C2C2E] text-white px-3 py-2 rounded-xl border border-[#3A3A3C] focus:outline-none" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#8E8E93]">종료 시간</span>
              <input type="time" value={tempTime.end} onChange={(e) => setTempTime({ ...tempTime, end: e.target.value })} className="bg-[#2C2C2E] text-white px-3 py-2 rounded-xl border border-[#3A3A3C] focus:outline-none" />
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