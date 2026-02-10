import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, MoreHorizontal, Sparkles, Users } from 'lucide-react';
import { supabase } from '../../shared/lib/supabaseClient';
import { useAuth } from '../../features/auth/contexts/AuthContext';
import GraynLogo from '../../assets/grayn_logo.svg';

const navItems = [
  { id: 'friends',  path: '/main/friends',  icon: 'logo' },
  { id: 'chats',    path: '/main/chats',    icon: 'chat' },
  { id: 'contents', path: '/main/contents', icon: 'sparkles' },
  { id: 'gathering',path: '/main/gathering',icon: 'users' },
  { id: 'settings', path: '/main/settings', icon: 'more' },
];

// #FF203A 컬러로 변환하는 CSS filter 체인
// brightness(0) → 흑백 → sepia+saturate+hue-rotate → #FF203A
const LOGO_ACTIVE_FILTER =
  'brightness(0) saturate(100%) invert(14%) sepia(95%) saturate(6000%) hue-rotate(344deg) brightness(104%)';
const LOGO_INACTIVE_FILTER =
  'brightness(0) invert(1) opacity(0.38)';

export default function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [hasUnreadChats, setHasUnreadChats] = useState(false);
  const [pressedId, setPressedId] = useState<string | null>(null);

  const getActiveId = () => {
    const path = location.pathname;
    if (path.startsWith('/main/gathering')) return 'gathering';
    for (const item of navItems) {
      if (path.includes(item.id)) return item.id;
    }
    return 'friends';
  };

  const activeId = getActiveId();

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

        if (error) { console.warn('Nav check failed:', error.message); return; }
        setHasUnreadChats(!!data);
      } catch (err) {
        console.error('Check unread exception:', err);
      }
    };

    checkUnreadChats();

    const channel = supabase
      .channel(`bottom_nav_${user.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'room_members',
        filter: `user_id=eq.${user.id}`
      }, checkUnreadChats)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handlePress = (id: string, path: string) => {
    setPressedId(id);
    setTimeout(() => setPressedId(null), 250);
    navigate(path);
  };

  const renderIcon = (item: typeof navItems[number], isActive: boolean) => {
    const color  = isActive ? '#FF203A' : 'rgba(235,235,245,0.38)';
    const glow   = isActive ? 'drop-shadow(0 0 7px rgba(255,32,58,0.55))' : 'none';
    const stroke = isActive ? 2.1 : 1.6;

    if (item.icon === 'logo') {
      return (
        <img
          src={GraynLogo}
          alt="홈"
          className="w-[22px] h-[22px]"
          style={{
            filter: isActive ? LOGO_ACTIVE_FILTER : LOGO_INACTIVE_FILTER,
            transition: 'filter 0.25s ease',
          }}
        />
      );
    }

    const iconProps = {
      className: 'w-[22px] h-[22px]',
      style: {
        color,
        strokeWidth: stroke,
        filter: glow,
        transition: 'all 0.2s ease',
      } as React.CSSProperties,
    };

    if (item.icon === 'chat')     return <MessageCircle  {...iconProps} />;
    if (item.icon === 'sparkles') return <Sparkles       {...iconProps} />;
    if (item.icon === 'users')    return <Users          {...iconProps} />;
    if (item.icon === 'more')     return <MoreHorizontal {...iconProps} />;
    return null;
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
    >
      <nav
        className="pointer-events-auto mx-5 w-full max-w-[320px]"
        style={{
          background: 'rgba(22, 22, 24, 0.78)',
          backdropFilter: 'blur(32px) saturate(200%)',
          WebkitBackdropFilter: 'blur(32px) saturate(200%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '32px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.05) inset',
        }}
      >
        <div className="flex items-center justify-around px-3 h-[58px]">
          {navItems.map((item) => {
            const isActive  = activeId === item.id;
            const isPressed = pressedId === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handlePress(item.id, item.path)}
                className="relative flex items-center justify-center w-10 h-10 outline-none select-none"
              >
                {/* 활성 배경 */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      layoutId="active-bg"
                      initial={{ opacity: 0, scale: 0.7 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.7 }}
                      transition={{ type: 'spring', stiffness: 550, damping: 32 }}
                      className="absolute inset-0 rounded-[14px]"
                      style={{
                        background: 'rgba(255, 32, 58, 0.13)',
                        border: '1px solid rgba(255, 32, 58, 0.22)',
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* 아이콘 */}
                <motion.div
                  animate={{
                    scale: isPressed ? 0.78 : isActive ? 1.08 : 1,
                    y: isActive ? -0.5 : 0,
                  }}
                  transition={{ type: 'spring', stiffness: 620, damping: 26 }}
                  className="relative z-10 flex items-center justify-center"
                >
                  {renderIcon(item, isActive)}

                  {/* 채팅 미읽음 뱃지 */}
                  <AnimatePresence>
                    {item.id === 'chats' && hasUnreadChats && (
                      <motion.span
                        key="badge"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 600, damping: 22 }}
                        className="absolute -top-[3px] -right-[3px] w-[8px] h-[8px] rounded-full bg-[#FF203A]"
                        style={{ border: '1.5px solid rgba(22,22,24,0.9)' }}
                      >
                        <motion.span
                          className="absolute inset-0 rounded-full bg-[#FF203A]"
                          animate={{ scale: [1, 2.0, 1], opacity: [0.6, 0, 0.6] }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}