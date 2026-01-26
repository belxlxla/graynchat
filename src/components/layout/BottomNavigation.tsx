// src/components/layout/BottomNavigation.tsx
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MessageCircle, MoreHorizontal, Layers } from 'lucide-react';
// 로고 경로 확인 필수!
import GraynLogo from '../../assets/grayn_logo.svg';

export default function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    // id는 경로 매칭용, path는 실제 이동 경로
    { id: 'friends', path: '/main/friends', icon: 'custom', label: '홈' },
    { id: 'chats', path: '/main/chats', icon: <MessageCircle className="w-7 h-7" />, label: '채팅' },
    { id: 'contents', path: '/main/contents', icon: <Layers className="w-7 h-7" />, label: '콘텐츠' },
    { id: 'settings', path: '/main/settings', icon: <MoreHorizontal className="w-7 h-7" />, label: '설정' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[60px] bg-[#1C1C1E]/95 backdrop-blur-md border-t border-[#2C2C2E] flex justify-around items-center z-50 pb-safe">
      {navItems.map((item) => {
        // 현재 경로에 item.id가 포함되어 있으면 활성화 (예: /main/friends -> friends 활성화)
        const isActive = location.pathname.includes(item.id);

        return (
          <button
            key={item.id}
            onClick={() => navigate(item.path)}
            className="relative w-16 h-full flex items-center justify-center"
          >
            <div className={`transition-all duration-300 ${isActive ? 'scale-110 opacity-100' : 'opacity-40 hover:opacity-60'}`}>
              {item.icon === 'custom' ? (
                // 로고 이미지는 흑백/컬러 전환
                <img 
                  src={GraynLogo} 
                  alt="Home" 
                  className={`w-7 h-7 ${!isActive ? 'grayscale brightness-200' : ''}`} 
                />
              ) : (
                // 일반 아이콘은 색상 전환
                <span className={isActive ? 'text-brand-DEFAULT' : 'text-[#E5E5EA]'}>
                  {item.icon}
                </span>
              )}
            </div>
            
            {/* 활성화 시 하단 점 표시 */}
            {isActive && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute bottom-2 w-1 h-1 bg-brand-DEFAULT rounded-full"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}