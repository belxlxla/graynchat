import { useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNavigation from './BottomNavigation';

const MAIN_TAB_PATHS = [
  '/main/friends',   // home → friends
  '/main/chats',     // chat → chats
  '/main/contents',
  '/main/gathering',
  '/main/settings',
];

const getTabIndex = (pathname: string) =>
  MAIN_TAB_PATHS.findIndex(p => pathname === p || pathname.startsWith(p + '/'));

const isMainTab = (pathname: string) => getTabIndex(pathname) !== -1;

export default function MainLayout() {
  const location = useLocation();
  const prevTabIndexRef = useRef(getTabIndex(location.pathname));

  const currentTabIndex = getTabIndex(location.pathname);
  const isTab = isMainTab(location.pathname);

  const prevTabIndex = prevTabIndexRef.current;
  const direction =
    currentTabIndex > prevTabIndex ? 1 : currentTabIndex < prevTabIndex ? -1 : 0;

  if (isTab && currentTabIndex !== prevTabIndex) {
    prevTabIndexRef.current = currentTabIndex;
  }

  return (
    <div
      className="flex flex-col h-[100dvh] text-white overflow-hidden"
      style={{ background: '#0d0d0d' }}
    >
      <div className="flex-1 w-full relative overflow-hidden pb-[60px]">
        <AnimatePresence mode="popLayout" initial={false} custom={{ isTab, direction }}>
          <motion.div
            key={location.pathname}
            className="absolute inset-0 overflow-hidden"
            custom={{ isTab, direction }}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomNavigation />
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  Transition philosophy
//  • 탭 전환  : opacity 위주, x는 6px 이하 미세 힌트만
//              → 덜컹거림 없이 '슬쩍 바뀌는' 느낌
//  • 서브 페이지: y 10px 아래서 올라오는 슬라이드 + opacity
//              → iOS push 느낌
//  Exit 은 항상 Enter 보다 짧게 — 빠져나가는 건 빠르게,
//  들어오는 건 여유롭게.
// ─────────────────────────────────────────────────────────

// Bezier 튜플 (TypeScript 타입 안전)
const SPRING_ENTER = { type: 'spring', stiffness: 380, damping: 36, mass: 0.9 } as const;
const EASE_OUT     = [0.22, 1, 0.36, 1]    as [number, number, number, number];
const EASE_IN      = [0.55, 0, 1, 0.45]    as [number, number, number, number];

const pageVariants = {
  initial: ({ isTab, direction }: { isTab: boolean; direction: number }) =>
    isTab
      ? {
          opacity: 0,
          x: direction * 6,   // 아주 미세한 위치 힌트
          scale: 0.995,
          filter: 'blur(0px)',
        }
      : {
          opacity: 0,
          y: 14,
          scale: 0.98,
          filter: 'blur(0px)',
        },

  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      // spring 으로 자연스러운 감속
      ...SPRING_ENTER,
      opacity: { duration: 0.2, ease: EASE_OUT },
    },
  },

  exit: ({ isTab, direction }: { isTab: boolean; direction: number }) =>
    isTab
      ? {
          opacity: 0,
          x: direction * -5,
          scale: 1,
          filter: 'blur(0px)',
          transition: {
            duration: 0.14,
            ease: EASE_IN,
            opacity: { duration: 0.12 },
          },
        }
      : {
          opacity: 0,
          y: -8,
          scale: 1.005,
          filter: 'blur(0px)',
          transition: {
            duration: 0.15,
            ease: EASE_IN,
            opacity: { duration: 0.12 },
          },
        },
};