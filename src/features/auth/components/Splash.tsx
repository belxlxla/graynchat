import { useEffect } from 'react';
import { motion } from 'framer-motion';
import logoSvg from '../../../assets/grayn_logo.svg';

interface SplashProps {
  onFinish: () => void;
}

export default function Splash({ onFinish }: SplashProps) {
  // ✅ 수정된 부분: 애니메이션 실행 시간 1초로 단축
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 1300);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div
      // ✅ 수정된 부분: 배경색 #212121 적용
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#212121] overflow-hidden"
      // 화면이 사라질 때의 효과 (부모 컴포넌트에서 AnimatePresence 사용 시 작동)
      exit={{ 
        opacity: 0, 
        scale: 1.1, 
        filter: "blur(10px)",
        transition: { duration: 0.5, ease: "easeInOut" } 
      }}
    >
      {/* 1. 로고 애니메이션: 블러 + 줌인 (시네마틱 포커스 효과) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.5, filter: "blur(20px)" }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          filter: "blur(0px)" 
        }}
        transition={{
          duration: 0.8,
          ease: [0.16, 1, 0.3, 1], // Apple 스타일의 쫀득한 베지어 곡선
        }}
        className="relative mb-6"
      >
        {/* 로고 뒤의 후광 효과 (Pulse) */}
        <motion.div 
          animate={{ 
            opacity: [0, 0.6, 0], 
            scale: [0.8, 1.3, 1.6] 
          }}
          transition={{ 
            duration: 1.5, 
            times: [0, 0.4, 1],
            ease: "easeOut" 
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-brand-DEFAULT/50 blur-[50px] rounded-full" 
        />
        
        <img 
          src={logoSvg} 
          alt="GRAYN" 
          className="w-28 h-28 relative z-10 drop-shadow-2xl" 
        />
      </motion.div>
      
      {/* 2. 텍스트 컨테이너: 순차 등장 */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.15,
              delayChildren: 0.3,
            }
          }
        }}
        className="flex flex-col items-center z-10"
      >
        {/* 타이틀: 아래에서 위로 솟아오르며 등장 */}
        <motion.h1 
          variants={{
            hidden: { y: 20, opacity: 0, letterSpacing: "0.1em" },
            visible: { 
              y: 0, 
              opacity: 1, 
              letterSpacing: "0.25em", // 자간이 넓어지며 고급스럽게
              transition: { type: "spring", stiffness: 100, damping: 20 }
            }
          }}
          className="text-4xl font-black text-white ml-3"
        >
          GRAYN
        </motion.h1>
        
        {/* 슬로건: 마스크 기법으로 텍스트가 스르륵 채워지는 효과 */}
        <motion.div 
          className="relative mt-3 overflow-hidden"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { duration: 0.5 } }
          }}
        >
          {/* 기본 텍스트 (어두운 색 - 베이스) */}
          <p className="text-gray-700 text-xs tracking-[0.2em] font-semibold">
            CONNECT BEYOND THE GRAYN.
          </p>
          
          {/* 하이라이트 텍스트 (밝은 색 + 스캔 애니메이션) */}
          <motion.p 
            initial={{ clipPath: "inset(0 100% 0 0)" }} // 오른쪽에서 왼쪽으로 가려짐
            animate={{ clipPath: "inset(0 0% 0 0)" }}   // 전체 보임
            transition={{ duration: 0.3, ease: "circOut", delay: 0.5 }}
            className="absolute top-0 left-0 text-brand-DEFAULT text-xs tracking-[0.2em] font-semibold"
          >
            CONNECT BEYOND THE GRAYN.
          </motion.p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}