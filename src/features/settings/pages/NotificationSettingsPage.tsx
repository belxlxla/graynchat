import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, Bell, MessageSquare, Volume2, 
  Moon, Sparkles, Clock, ChevronRight 
  // ✨ 에러 수정: 사용하지 않는 'X' 아이콘 임포트 제거
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
    mention: true, // 키워드 -> 멘션 알림으로 변경
    dnd: false,
  });

  const [dndTime, setDndTime] = useState({ start: '22:00', end: '08:00' });
  const [showDndPicker, setShowDndPicker] = useState(false);
  // ✨ 에러 수정: 읽지 않는 'permission' 변수를 생략하고 setter만 유지
  const [, setPermission] = useState<NotificationPermission>('default');

  // 1. 초기 데이터 로드 및 권한 확인
  const fetchSettings = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    // 브라우저 알림 권한 상태 체크
    setPermission(Notification.permission);

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
      setDndTime({ start: data.dnd_start.slice(0, 5), end: data.dnd_end.slice(0, 5) });
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // 2. 알림 권한 요청 (앱 처음 시작 시나 설정 켤 때 호출)
  const requestPermission = async () => {
    if (Notification.permission === 'default') {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        toast.success('알림 권한이 허용되었습니다.');
      }
    }
  };

  // 3. 토글 핸들러 (전체 토글 및 개별 토글 로직)
  const handleToggle = async (key: keyof typeof settings) => {
    let newSettings = { ...settings, [key]: !settings[key] };

    // ✨ 전체 알림 받기 토글 시 모든 하위 항목 동기화
    if (key === 'all') {
      const targetState = !settings.all;
      newSettings = {
        all: targetState,
        preview: targetState,
        mention: targetState,
        sound: targetState,
        vibrate: targetState,
        dnd: settings.dnd, // 방해금지는 개별 유지
      };
      if (targetState) await requestPermission();
    }

    setSettings(newSettings);

    // Supabase DB 업데이트
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('users').update({
        notify_all: newSettings.all,
        notify_preview: newSettings.preview,
        notify_mention: newSettings.mention,
        notify_sound: newSettings.sound,
        notify_vibrate: newSettings.vibrate,
        dnd_enabled: newSettings.dnd
      }).eq('id', session.user.id);
    }

    // 진동/소리 테스트 피드백
    if (key === 'vibrate' && newSettings.vibrate) window.navigator.vibrate?.(200);
  };

  // 4. 방해 금지 시간 저장
  const saveDndTime = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await supabase.from('users').update({
        dnd_start: dndTime.start,
        dnd_end: dndTime.end
      }).eq('id', session.user.id);
      toast.success('방해금지 시간이 설정되었습니다.');
      setShowDndPicker(false);
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

      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 space-y-8">
        
        {/* Main Toggle */}
        <div className="bg-[#2C2C2E] rounded-2xl p-5 flex items-center justify-between border border-[#3A3A3C] shadow-xl">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${settings.all ? 'bg-brand-DEFAULT/20 text-brand-DEFAULT' : 'bg-[#3A3A3C] text-[#8E8E93]'}`}>
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-bold text-white">전체 알림 받기</h3>
              <p className="text-xs text-[#8E8E93] mt-0.5">모든 푸시 알림을 제어합니다.</p>
            </div>
          </div>
          <Switch checked={settings.all} onChange={() => handleToggle('all')} />
        </div>

        <Section title="메시지 알림">
          <ToggleItem 
            icon={<MessageSquare className="w-5 h-5" />} 
            label="메시지 미리보기" 
            checked={settings.preview} 
            onChange={() => handleToggle('preview')} 
            disabled={!settings.all}
          />
          <ToggleItem 
            icon={<Sparkles className="w-5 h-5" />} 
            label="멘션 알림" 
            checked={settings.mention} 
            onChange={() => handleToggle('mention')} 
            disabled={!settings.all}
          />
        </Section>

        <Section title="소리 및 진동">
          <ToggleItem 
            icon={<Volume2 className="w-5 h-5" />} 
            label="알림음" 
            checked={settings.sound} 
            onChange={() => handleToggle('sound')} 
            disabled={!settings.all}
          />
          <ToggleItem 
            icon={<SmartphoneIcon />} 
            label="진동" 
            checked={settings.vibrate} 
            onChange={() => handleToggle('vibrate')} 
            disabled={!settings.all}
          />
        </Section>

        <Section title="기타">
          <ToggleItem 
            icon={<Moon className="w-5 h-5" />} 
            label="방해금지 시간대 설정" 
            checked={settings.dnd} 
            onChange={() => handleToggle('dnd')} 
          />
          {settings.dnd && (
            <button 
              onClick={() => setShowDndPicker(true)}
              className="w-full flex items-center justify-between px-5 py-4 bg-[#1C1C1E] border-t border-[#3A3A3C] animate-fade-in"
            >
              <div className="flex items-center gap-3 text-[#8E8E93]">
                <Clock size={16} />
                <span className="text-sm">설정 시간</span>
              </div>
              <div className="flex items-center gap-1 text-brand-DEFAULT font-bold text-sm">
                {dndTime.start} ~ {dndTime.end}
                <ChevronRight size={16} />
              </div>
            </button>
          )}
        </Section>

      </div>

      <AnimatePresence>
        {showDndPicker && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDndPicker(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative z-10 w-full max-w-[320px] bg-[#1C1C1E] border border-[#3A3A3C] rounded-[32px] p-6 shadow-2xl">
              <h3 className="text-lg font-bold mb-6 text-center">방해금지 시간 설정</h3>
              <div className="space-y-6 mb-8">
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[#8E8E93] ml-1 uppercase">Start Time</label>
                  <input type="time" value={dndTime.start} onChange={(e) => setDndTime({...dndTime, start: e.target.value})} className="w-full bg-[#2C2C2E] border-none rounded-xl p-4 text-white font-mono text-lg" />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs text-[#8E8E93] ml-1 uppercase">End Time</label>
                  <input type="time" value={dndTime.end} onChange={(e) => setDndTime({...dndTime, end: e.target.value})} className="w-full bg-[#2C2C2E] border-none rounded-xl p-4 text-white font-mono text-lg" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDndPicker(false)} className="flex-1 py-4 bg-[#2C2C2E] rounded-2xl font-bold">취소</button>
                <button onClick={saveDndTime} className="flex-1 py-4 bg-brand-DEFAULT rounded-2xl font-bold">저장</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// === Sub Components ===

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-black text-[#636366] ml-2 mb-2 uppercase tracking-widest">{title}</h3>
      <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C] shadow-lg">
        {children}
      </div>
    </div>
  );
}

function ToggleItem({ 
  icon, label, checked, onChange, disabled 
}: { 
  icon: React.ReactNode, label: string, checked: boolean, onChange: () => void, disabled?: boolean 
}) {
  return (
    <div className={`flex items-center justify-between px-5 py-4 transition-opacity ${disabled ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
      <div className="flex items-center gap-3">
        <div className="text-[#8E8E93]">{icon}</div>
        <span className="text-[15px] text-white">{label}</span>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

function Switch({ checked, onChange, disabled }: { checked: boolean, onChange: () => void, disabled?: boolean }) {
  return (
    <button 
      onClick={onChange}
      disabled={disabled}
      className={`w-[50px] h-[28px] rounded-full p-1 transition-colors duration-300 ease-in-out ${checked ? 'bg-brand-DEFAULT shadow-[0_0_10px_rgba(var(--brand-rgb),0.3)]' : 'bg-[#48484A]'}`}
    >
      <motion.div 
        className="w-5 h-5 bg-white rounded-full shadow-md"
        animate={{ x: checked ? 22 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

const SmartphoneIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" />
  </svg>
);