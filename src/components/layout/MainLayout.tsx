import { Outlet, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import BottomNavigation from './BottomNavigation';

export default function MainLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-[100dvh] bg-dark-bg text-white overflow-hidden">
      {/* [구조 설명]
        flex-1: 하단바 제외 남은 공간 전체 사용
        overflow-hidden: 이 레이아웃 자체는 스크롤되지 않고, 내부 페이지(Outlet)가 스크롤됨
        pb-[60px]: 하단바 높이만큼 공간 확보
      */}
      <div className="flex-1 w-full h-full relative overflow-hidden pb-[60px]">
        {/* [수정 포인트]
           1. AnimatePresence mode="wait" 제거 -> 화면 깜빡임/딜레이 제거
           2. exit 애니메이션 제거 -> 이전 탭은 즉시 사라짐
           3. key={location.pathname} -> 경로가 바뀔 때마다 Fade In 효과 실행
        */}
        <motion.div
          key={location.pathname}
          className="w-full h-full overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <Outlet />
        </motion.div>
      </div>

      {/* 하단 네비게이션바 (고정) */}
      <BottomNavigation />
    </div>
  );
}