import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, Music, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationSettingsPage() {
  const navigate = useNavigate();

  // === States ===
  const [preview, setPreview] = useState(true);
  const [inAppNotify, setInAppNotify] = useState(true);
  const [inAppSound, setInAppSound] = useState(true);
  const [inAppVibrate, setInAppVibrate] = useState(true);
  const [replyNotify, setReplyNotify] = useState(true);
  const [dmMention, setDmMention] = useState(true);
  const [groupMention, setGroupMention] = useState(true);

  // === Handler ===
  const handleToggle = (state: boolean, setState: (val: boolean) => void, label: string) => {
    const newState = !state;
    setState(newState);
    // 사용자 경험을 위해 짧은 토스트 피드백 제공 (선택 사항)
    // toast.success(`${label} ${newState ? '켜짐' : '꺼짐'}`, { duration: 1000 });
  };

  const handleSoundSelect = () => {
    toast('시스템 알림음 설정으로 이동합니다. (준비중)');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* Header */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">알림</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10 pt-4">
        <div className="px-5 space-y-6">

          {/* Section 1: 알림음 & 미리보기 */}
          <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
            {/* 알림음 선택 */}
            <button 
              onClick={handleSoundSelect}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] active:bg-[#48484A] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Music className="w-5 h-5 text-[#8E8E93]" />
                <span className="text-[15px] text-white">알림음 선택</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] text-[#8E8E93]">기본음</span>
                <ChevronRight className="w-4 h-4 text-[#636366] group-hover:text-[#8E8E93]" />
              </div>
            </button>

            <div className="h-[1px] bg-[#3A3A3C] mx-4" />

            {/* 미리보기 */}
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <span className="text-[15px] text-white block mb-1">미리보기</span>
                <span className="text-[11px] text-[#8E8E93] leading-tight block">
                  푸시 알림이 있을 때 메시지의<br/>일부를 보여줍니다.
                </span>
              </div>
              <Toggle isOn={preview} onToggle={() => handleToggle(preview, setPreview, '미리보기')} />
            </div>
          </div>

          {/* Section 2: 앱 실행 중 알림 */}
          <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
            <div className="px-5 py-4 flex items-center justify-between">
              <span className="text-[15px] text-white">앱 실행 중 알림</span>
              <Toggle isOn={inAppNotify} onToggle={() => handleToggle(inAppNotify, setInAppNotify, '앱 실행 중 알림')} />
            </div>

            {/* 하위 옵션 (앱 실행 중 알림이 켜져있을 때만 활성) */}
            <div className={`transition-opacity duration-200 ${inAppNotify ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <div className="h-[1px] bg-[#3A3A3C] mx-4" />
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-[15px] text-white">앱 실행 중 사운드</span>
                <Toggle isOn={inAppSound} onToggle={() => handleToggle(inAppSound, setInAppSound, '사운드')} />
              </div>
              <div className="h-[1px] bg-[#3A3A3C] mx-4" />
              <div className="px-5 py-4 flex items-center justify-between">
                <span className="text-[15px] text-white">앱 실행 중 진동</span>
                <Toggle isOn={inAppVibrate} onToggle={() => handleToggle(inAppVibrate, setInAppVibrate, '진동')} />
              </div>
            </div>
          </div>

          {/* Section 3: 답장/멘션 */}
          <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C]">
            {/* 답장 알림 */}
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="pr-4">
                <span className="text-[15px] text-white block mb-1">답장/댓글 알림</span>
                <span className="text-[11px] text-[#8E8E93] leading-tight block">
                  내가 전송한 메시지에 답장이 달리면<br/>채팅방 알림이 꺼져있어도 알림을<br/>받을 수 있습니다.
                </span>
              </div>
              <Toggle isOn={replyNotify} onToggle={() => handleToggle(replyNotify, setReplyNotify, '답장 알림')} />
            </div>

            <div className="h-[1px] bg-[#3A3A3C] mx-4" />

            {/* 멘션 알림 */}
            <div className="px-5 py-4 flex items-center justify-between">
              <span className="text-[15px] text-white">일반채팅 멘션 알림</span>
              <Toggle isOn={dmMention} onToggle={() => handleToggle(dmMention, setDmMention, '일반채팅 멘션')} />
            </div>
            <div className="h-[1px] bg-[#3A3A3C] mx-4" />
            <div className="px-5 py-4 flex items-center justify-between">
              <span className="text-[15px] text-white">그룹채팅방 멘션 알림</span>
              <Toggle isOn={groupMention} onToggle={() => handleToggle(groupMention, setGroupMention, '그룹채팅 멘션')} />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// Reusable Toggle Component
function Toggle({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  return (
    <div 
      onClick={onToggle}
      className={`w-[52px] h-[32px] shrink-0 flex items-center rounded-full p-1 cursor-pointer transition-colors duration-300 ${
        isOn ? 'bg-brand-DEFAULT' : 'bg-[#3A3A3C]'
      }`}
    >
      <motion.div
        className="w-6 h-6 bg-white rounded-full shadow-md"
        animate={{ x: isOn ? 20 : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </div>
  );
}