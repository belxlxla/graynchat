import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ChevronLeft, Bell, Users, Image, FileText, Link, 
  LogOut, ChevronRight // ✨ Trash2 제거됨
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChatRoomSettingsPage() {
  const navigate = useNavigate();
  useParams(); 

  const [isMuted, setIsMuted] = useState(false);

  // 대화방 나가기
  const handleLeaveChat = () => {
    if (confirm('채팅방을 나가시겠습니까? 대화 내용이 모두 삭제됩니다.')) {
      toast.success('채팅방을 나갔습니다.');
      navigate('/main/chats');
    }
  };

  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    toast.success(isMuted ? '알림이 켜졌습니다.' : '알림이 꺼졌습니다.');
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      
      {/* Header */}
      <header className="h-14 px-2 flex items-center bg-[#1C1C1E] border-b border-[#2C2C2E] shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="p-2 text-white hover:text-brand-DEFAULT transition-colors">
          <ChevronLeft className="w-7 h-7" />
        </button>
        <h1 className="text-lg font-bold ml-1">채팅방 설정</h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-10">
        
        {/* 1. Chat Info */}
        <div className="p-6 flex flex-col items-center border-b border-[#2C2C2E]">
          <div className="w-24 h-24 bg-[#3A3A3C] rounded-[30px] mb-4 flex items-center justify-center overflow-hidden">
             {/* 임시 이미지 */}
             <div className="grid grid-cols-2 gap-1 p-2 w-full h-full">
                <div className="bg-[#48484A] rounded-lg"></div>
                <div className="bg-[#48484A] rounded-lg"></div>
                <div className="bg-[#48484A] rounded-lg"></div>
                <div className="bg-[#48484A] rounded-lg"></div>
             </div>
          </div>
          <h2 className="text-xl font-bold mb-1">개발팀 공지방</h2>
          <p className="text-[#8E8E93] text-sm">멤버 12명</p>
        </div>

        {/* 2. Menu List */}
        <div className="px-5 mt-6 space-y-6">
          
          {/* Storage Section */}
          <Section title="모아보기">
            <MenuItem icon={<Image className="w-5 h-5" />} label="사진/동영상" count={128} />
            <MenuItem icon={<FileText className="w-5 h-5" />} label="파일" count={12} />
            <MenuItem icon={<Link className="w-5 h-5" />} label="링크" count={45} />
          </Section>

          {/* Settings Section */}
          <Section title="관리">
            <div className="flex items-center justify-between px-5 py-4 bg-[#2C2C2E] rounded-2xl">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-[#8E8E93]" />
                <span className="text-[15px] text-white">알림 끄기</span>
              </div>
              <button 
                onClick={handleToggleMute}
                className={`w-12 h-7 rounded-full p-1 transition-colors duration-200 ease-in-out ${isMuted ? 'bg-brand-DEFAULT' : 'bg-[#48484A]'}`}
              >
                <motion.div 
                  className="w-5 h-5 bg-white rounded-full shadow-sm"
                  animate={{ x: isMuted ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
            <MenuItem icon={<Users className="w-5 h-5" />} label="대화상대 초대" />
          </Section>

          {/* Danger Zone */}
          <div className="space-y-3 pt-4">
            <button 
              onClick={handleLeaveChat}
              className="w-full py-4 bg-[#2C2C2E] text-[#FF453A] font-medium rounded-2xl flex items-center justify-center gap-2 hover:bg-[#3A3A3C] transition-colors"
            >
              <LogOut className="w-5 h-5" />
              채팅방 나가기
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-[#8E8E93] ml-1 mb-2">{title}</h3>
      <div className="bg-[#2C2C2E] rounded-2xl overflow-hidden border border-[#3A3A3C] divide-y divide-[#3A3A3C]">
        {children}
      </div>
    </div>
  );
}

function MenuItem({ icon, label, count }: { icon: React.ReactNode, label: string, count?: number }) {
  return (
    <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#3A3A3C] transition-colors group">
      <div className="flex items-center gap-3">
        <div className="text-[#8E8E93] group-hover:text-white transition-colors">{icon}</div>
        <span className="text-[15px] text-white">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {count !== undefined && <span className="text-[13px] text-[#8E8E93]">{count}</span>}
        <ChevronRight className="w-4 h-4 text-[#636366]" />
      </div>
    </button>
  );
}