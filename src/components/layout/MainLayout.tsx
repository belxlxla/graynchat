import { useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import BottomNavigation from './BottomNavigation';

const MAIN_TAB_PATHS = ['/main/home', '/main/chat', '/main/gathering', '/main/contents', '/main/settings'];

const isMainTab = (pathname: string) =>
  MAIN_TAB_PATHS.some(p => pathname === p || pathname.startsWith(p + '/') && MAIN_TAB_PATHS.includes(pathname));

const getTabIndex = (pathname: string) =>
  MAIN_TAB_PATHS.findIndex(p => pathname === p || pathname.startsWith(p));

// cubic-bezier 튜플을 타입 안전하게 선언
const EASE_DECEL  = [0.32, 0.72, 0,    1   ] as [number, number, number, number];
const EASE_SMOOTH = [0.25, 0.1,  0.25, 1   ] as [number, number, number, number];
const EASE_ACCEL  = [0.32, 0,    0.67, 0   ] as [number, number, number, number];

export default function MainLayout() {
  const location = useLocation();
  const prevTabIndexRef = useRef(getTabIndex(location.pathname));

  const currentTabIndex = getTabIndex(location.pathname);
  const isTab = isMainTab(location.pathname);

  const prevTabIndex = prevTabIndexRef.current;
  const direction = currentTabIndex > prevTabIndex ? 1 : currentTabIndex < prevTabIndex ? -1 : 0;

  if (isTab && currentTabIndex !== prevTabIndex) {
    prevTabIndexRef.current = currentTabIndex;
  }

  return (
    <div
      className="flex flex-col h-[100dvh] text-white overflow-hidden"
      style={{ background: '#0d0d0d' }}
    >
      <div className="flex-1 w-full relative overflow-hidden pb-[60px]">
        <AnimatePresence mode="popLayout" initial={false}>
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

const pageVariants = {
  initial: ({ isTab, direction }: { isTab: boolean; direction: number }) => ({
    opacity: 0,
    x: isTab ? direction * 18 : 0,
    y: isTab ? 0 : 12,
    scale: isTab ? 1 : 0.99,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: {
      opacity: { duration: 0.22, ease: EASE_SMOOTH },
      x:       { duration: 0.28, ease: EASE_DECEL  },
      y:       { duration: 0.26, ease: EASE_DECEL  },
      scale:   { duration: 0.26, ease: EASE_DECEL  },
    },
  },
  exit: ({ isTab, direction }: { isTab: boolean; direction: number }) => ({
    opacity: 0,
    x: isTab ? direction * -18 : 0,
    y: isTab ? 0 : -6,
    scale: isTab ? 1 : 1.01,
    transition: {
      opacity: { duration: 0.16, ease: 'easeIn'   as const },
      x:       { duration: 0.18, ease: EASE_ACCEL },
      y:       { duration: 0.16, ease: 'easeIn'   as const },
      scale:   { duration: 0.16, ease: 'easeIn'   as const },
    },
  }),
};