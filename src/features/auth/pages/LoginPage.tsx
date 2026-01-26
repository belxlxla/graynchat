// src/features/auth/pages/LoginPage.tsx
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { useNaverLogin } from '../hooks/useNaverLogin';

import logoSvg from '../../../assets/grayn_logo.svg';
import naverIcon from '../../../assets/naver_login.svg';
import googleIcon from '../../../assets/google_login.svg';
import appleIcon from '../../../assets/apple_login.svg';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

const itemVariants: Variants = {
  hidden: { y: 50, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100, damping: 15, mass: 1 }
  },
};

// ✨ [추가] 부모(App.tsx)에게 "다음 페이지로 가줘"라고 요청할 도구
interface LoginPageProps {
  onNextStep: () => void; 
}

export default function LoginPage({ onNextStep }: LoginPageProps) {
  const { triggerNaverLogin } = useNaverLogin();

  const handleSocialLogin = async (provider: 'google' | 'naver' | 'apple') => {
    // 1. 네이버인 경우
    if (provider === 'naver') {
      triggerNaverLogin();
      // 실제로는 로그인 성공 후 이동해야 하지만, 지금 화면 흐름 테스트를 위해 바로 이동시킵니다.
      // 나중에 실제 연동 완료되면 이 줄은 성공 콜백 안으로 옮겨야 합니다.
      setTimeout(onNextStep, 500); 
      return;
    }

    // 2. 구글/애플인 경우 (UI 흐름 확인용)
    console.log(`${provider} 로그인 시도...`);
    // 💡 중요: 버튼 누르면 0.5초 뒤에 핸드폰 인증 페이지로 넘어갑니다.
    setTimeout(onNextStep, 500); 
  };

  return (
    <motion.div
      className="min-h-screen flex flex-col items-center justify-center bg-dark-bg px-6 relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      <div id="naverIdLogin" style={{ display: 'none' }} />

      {/* 로고 영역 */}
      <motion.div variants={itemVariants} className="mb-16 relative">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-brand-DEFAULT/10 blur-[60px] rounded-full" />
        <img src={logoSvg} alt="GRAYN" className="w-20 h-20 relative z-10 drop-shadow-lg" />
      </motion.div>

      <motion.div variants={itemVariants} className="mb-8 text-center">
        <h2 className="text-sm font-bold tracking-widest text-brand-DEFAULT uppercase">
          Continue with
        </h2>
      </motion.div>

      {/* 버튼 영역 */}
      <motion.div variants={itemVariants} className="flex gap-8 items-center justify-center">
        <button onClick={() => handleSocialLogin('naver')} className="hover:scale-110 active:scale-95 transition-transform duration-200">
          <img src={naverIcon} alt="Naver" className="w-16 h-16" />
        </button>
        <button onClick={() => handleSocialLogin('google')} className="hover:scale-110 active:scale-95 transition-transform duration-200">
          <img src={googleIcon} alt="Google" className="w-16 h-16" />
        </button>
        <button onClick={() => handleSocialLogin('apple')} className="hover:scale-110 active:scale-95 transition-transform duration-200">
          <img src={appleIcon} alt="Apple" className="w-16 h-16" /> 
        </button>
      </motion.div>
      <div className="h-20" /> 
    </motion.div>
  );
}