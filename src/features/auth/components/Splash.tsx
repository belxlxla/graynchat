// src/features/auth/components/Splash.tsx
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import logoSvg from '../../../assets/grayn_logo.svg'; // 로고 경로 확인!

interface SplashProps {
  onFinish: () => void;
}

// 컨테이너 애니메이션: 자식들을 순차적으로 보여주고, 마지막에 전체가 위로 사라짐
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2, // 로고 -> 제목 -> 슬로건 순서로 0.2초 간격 등장
      delayChildren: 0.3,
    },
  },
  exit: {
    y: '-100%', // 위로 샥 사라짐
    opacity: 0,
    transition: { 
      duration: 0.5, 
      ease: [0.4, 0, 0.2, 1] // 세련된 가속도 커브
    }
  }
};

// 아이템(로고, 텍스트) 애니메이션: 아래에서 위로 탄력있게 등장
const itemVariants: Variants = {
  hidden: { 
    y: 40, 
    opacity: 0,
    scale: 0.9
  },
  visible: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: { 
      type: "spring", // 탄력 있는 스프링 효과
      stiffness: 100,
      damping: 15
    }
  },
};

export default function Splash({ onFinish }: SplashProps) {
  return (
    <motion.div
      // 핵심 스타일: 전체 화면 덮기(fixed inset-0), Flex로 중앙 정렬, 배경색 지정(bg-dark-bg)
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-dark-bg"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      // 총 표시 시간 단축 (애니메이션 시간 포함 약 2초 후 종료)
      onAnimationComplete={() => setTimeout(onFinish, 1500)} 
    >
      {/* 로고 영역 */}
      <motion.div variants={itemVariants} className="relative mb-8">
        {/* 로고 뒤의 은은한 빛 효과 */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-brand-DEFAULT/30 blur-[80px] rounded-full" />
        <img 
          src={logoSvg} 
          alt="GRAYN" 
          className="w-24 h-24 relative z-10 drop-shadow-[0_0_15px_rgba(255,32,58,0.5)]" 
        />
      </motion.div>
      
      {/* 앱 이름 */}
      <motion.h1 
        variants={itemVariants}
        className="text-3xl font-bold text-brand-DEFAULT tracking-[0.25em] ml-2"
      >
        GRAYN
      </motion.h1>
      
      {/* 슬로건 */}
      <motion.p 
        variants={itemVariants}
        className="mt-4 text-dark-text-secondary text-sm tracking-wider font-medium"
      >
        CONNECT BEYOND THE GRAYN.
      </motion.p>
    </motion.div>
  );
}