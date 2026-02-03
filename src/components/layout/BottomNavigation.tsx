import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, MoreHorizontal, Sparkles } from 'lucide-react'; // 구문 오류 수정
import { supabase } from '../../shared/lib/supabaseClient';
import { useAuth } from '../../features/auth/contexts/AuthContext';
import GraynLogo from '../../assets/grayn_logo.svg';

export default function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  // 모달 관련 state 제거됨
  const [hasUnreadChats, setHasUnreadChats] = useState(false);

  const navItems = [
    { id: 'friends', path: '/main/friends', icon: 'custom', label: '홈' },
    { id: 'chats', path: '/main/chats', icon: <MessageCircle className="w-7 h-7" />, label: '채팅' },
    // 아이콘을 Layers -> Sparkles로 변경 (새로운 콘텐츠/스토어 느낌)
    { id: 'contents', path: '/main/contents', icon: <Sparkles className="w-7 h-7" />, label: '콘텐츠' },
    { id: 'settings', path: '/main/settings', icon: <MoreHorizontal className="w-7 h-7" />, label: '설정' },
  ];

  useEffect(() => {
    if (!user?.id) return;

    const checkUnreadChats = async () => {
      try {
        const { data, error } = await supabase
          .from('room_members')
          .select('unread_count')
          .eq('user_id', user.id)
          .gt('unread_count', 0)
          .limit(1)
          .maybeSingle();

        if (error) {
          console.warn('Nav check failed:', error.message);
          return;
        }
        
        setHasUnreadChats(!!data);

      } catch (error) {
        console.error('Check unread exception:', error);
      }
    };

    checkUnreadChats();

    const channel = supabase
      .channel(`bottom_nav_${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'room_members',
        filter: `user_id=eq.${user.id}`
      }, () => {
        checkUnreadChats();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // [수정] id 파라미터 제거 (사용하지 않음으로 인한 빌드 에러 해결)
  const handleNavClick = (path: string) => {
    navigate(path);
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 h-[80px] bg-[#1C1C1E]/95 backdrop-blur-md border-t border-[#2C2C2E] flex justify-around items-center z-50 pb-safe">
        {navItems.map((item) => {
          const isActive = location.pathname.includes(item.id);

          return (
            <button
              key={item.id}
              // [수정] handleNavClick 호출 시 id 제거
              onClick={() => handleNavClick(item.path)}
              className="relative w-16 h-full flex items-center justify-center"
            >
              <div className={`transition-all duration-300 ${isActive ? 'scale-110 opacity-100' : 'opacity-40 hover:opacity-60'}`}>
                {item.icon === 'custom' ? (
                  <img 
                    src={GraynLogo} 
                    alt="Home" 
                    className={`w-7 h-7 ${!isActive ? 'grayscale brightness-200' : ''}`} 
                  />
                ) : (
                  <span className={isActive ? 'text-brand-DEFAULT' : 'text-[#E5E5EA]'}>
                    {item.icon}
                  </span>
                )}
              </div>
              
              {/* 채팅 알림 뱃지 - 인터랙티브 애니메이션 */}
              <AnimatePresence>
                {item.id === 'chats' && hasUnreadChats && (
                  <motion.div
                    key="chat-badge"
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: [0, 1.2, 1],
                      opacity: 1
                    }}
                    exit={{ 
                      scale: [1, 1.3, 0],
                      opacity: [1, 0.8, 0]
                    }}
                    transition={{ 
                      duration: 0.4,
                      ease: "easeOut",
                      times: [0, 0.6, 1]
                    }}
                    className="absolute top-3 right-3 w-2 h-2 bg-[#EC5022] rounded-full border border-[#1C1C1E] shadow-lg"
                  >
                    {/* 펄스 애니메이션 - 새 메시지 강조 */}
                    <motion.div
                      className="absolute inset-0 bg-[#EC5022] rounded-full"
                      animate={{
                        scale: [1, 1.8, 1],
                        opacity: [0.6, 0, 0.6]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut"
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
              
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
    </>
  );
}