import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, MoreHorizontal, Layers, Rocket, Sparkles, X } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient';
import { useAuth } from '../../features/auth/contexts/AuthContext';
import GraynLogo from '../../assets/grayn_logo.svg';

export default function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [isContentModalOpen, setIsContentModalOpen] = useState(false);
  const [hasUnreadChats, setHasUnreadChats] = useState(false);

  const navItems = [
    { id: 'friends', path: '/main/friends', icon: 'custom', label: '홈' },
    { id: 'chats', path: '/main/chats', icon: <MessageCircle className="w-7 h-7" />, label: '채팅' },
    { id: 'contents', path: '/main/contents', icon: <Layers className="w-7 h-7" />, label: '콘텐츠' },
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

  const handleNavClick = (id: string, path: string) => {
    if (id === 'contents') {
      setIsContentModalOpen(true);
    } else {
      navigate(path);
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 h-[80px] bg-[#1C1C1E]/95 backdrop-blur-md border-t border-[#2C2C2E] flex justify-around items-center z-50 pb-safe">
        {navItems.map((item) => {
          const isActive = location.pathname.includes(item.id);

          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id, item.path)}
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

      {/* 콘텐츠 준비중 모달 */}
      <AnimatePresence>
        {isContentModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setIsContentModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-[320px] bg-[#1C1C1E] border border-white/10 rounded-3xl p-8 overflow-hidden shadow-2xl text-center"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-brand-DEFAULT/20 blur-[60px] rounded-full pointer-events-none" />

              <button 
                onClick={() => setIsContentModalOpen(false)}
                className="absolute top-4 right-4 text-[#8E8E93] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="relative mb-6 flex justify-center">
                <div className="w-20 h-20 bg-gradient-to-br from-[#3A3A3C] to-[#2C2C2E] rounded-full flex items-center justify-center shadow-inner border border-white/5 relative z-10">
                  <Rocket className="w-10 h-10 text-brand-DEFAULT fill-brand-DEFAULT/20 -ml-1 -mt-1" />
                </div>
                
                <motion.div 
                  className="absolute -top-3 -right-2 z-20"
                  animate={{ 
                    y: [0, -8, 0],       
                    rotate: [0, 20, -10], 
                    scale: [1, 1.2, 1], 
                    opacity: [0.8, 1, 0.8]
                  }}
                  transition={{ 
                    duration: 3.5, 
                    ease: "easeInOut", 
                    repeat: Infinity,
                    repeatType: "mirror"
                  }}
                >
                  <Sparkles className="w-7 h-7 text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" />
                </motion.div>
              </div>

              <h3 className="text-xl font-bold text-white mb-3">그레인 콘텐츠</h3>
              <div className="text-[13px] text-[#8E8E93] leading-relaxed space-y-1 mb-8">
                <p>해당 페이지는 현재 그레인이</p>
                <p>더 풍성한 앱이 되기 위해 <span className="text-brand-DEFAULT font-semibold">준비중</span>입니다.</p>
                <p className="pt-2">잠시만 기다려주시면 곧 오픈하겠습니다!</p>
              </div>

              <button 
                onClick={() => setIsContentModalOpen(false)}
                className="w-full py-3.5 bg-brand-DEFAULT rounded-xl text-white font-bold text-sm hover:bg-brand-hover transition-colors shadow-lg shadow-brand-DEFAULT/20"
              >
                기대해주세요!
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}