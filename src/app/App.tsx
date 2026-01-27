import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';

import Splash from '../features/auth/components/Splash';
import LoginPage from '../features/auth/pages/LoginPage';
import PhoneAuthPage from '../features/auth/pages/PhoneAuthPage';
import ProfileSetupPage from '../features/auth/pages/ProfileSetupPage';

// Pages
import FriendsListPage from '../features/chat/pages/FriendsListPage';
import ChatListPage from '../features/chat/pages/ChatListPage';
import ChatRoomPage from '../features/chat/pages/ChatRoomPage';
import SettingsPage from '../features/settings/pages/SettingsPage';
import AccountInfoPage from '../features/settings/pages/AccountInfoPage';
import SecurityPage from '../features/settings/pages/SecurityPage'; // ✨ 추가됨

import MainLayout from '../components/layout/MainLayout';

const Placeholder = ({ title }: { title: string }) => (
  <div className="h-full flex flex-col items-center justify-center text-[#8E8E93] gap-2">
    <span className="text-4xl">🚧</span>
    <p className="text-lg font-bold text-white">{title}</p>
  </div>
);

function App() {
  const [currentStep, setCurrentStep] = useState<'splash' | 'auth' | 'main'>('splash');

  if (currentStep === 'splash') return <Splash onFinish={() => setCurrentStep('auth')} />;
  if (currentStep === 'auth') {
    return (
      <div className="app-container bg-dark-bg min-h-screen">
        <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
        <AuthFlow onComplete={() => setCurrentStep('main')} />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }} />
      <Routes>
        <Route path="/main" element={<MainLayout />}>
          <Route index element={<Navigate to="friends" replace />} />
          <Route path="friends" element={<FriendsListPage />} />
          <Route path="chats" element={<ChatListPage />} />
          <Route path="contents" element={<Placeholder title="그레인 콘텐츠" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* 독립 페이지들 (하단 탭 없음) */}
        <Route path="/chat/room/:chatId" element={<ChatRoomPage />} />
        <Route path="/settings/account" element={<AccountInfoPage />} />
        <Route path="/settings/security" element={<SecurityPage />} /> {/* ✨ 라우트 추가 */}

        <Route path="*" element={<Navigate to="/main/friends" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function AuthFlow({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<'login' | 'phone' | 'profile'>('login');
  return (
    <AnimatePresence mode="wait">
      {step === 'login' && <LoginPage key="login" onNextStep={() => setStep('phone')} />}
      {step === 'phone' && <PhoneAuthPage key="phone" onBackToLogin={() => setStep('login')} onNewUser={() => setStep('profile')} />}
      {step === 'profile' && <ProfileSetupPage key="profile" onComplete={onComplete} />}
    </AnimatePresence>
  );
}

export default App;