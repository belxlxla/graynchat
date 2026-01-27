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
import SecurityPage from '../features/settings/pages/SecurityPage';
import PrivacyManagementPage from '../features/settings/pages/PrivacyManagementPage';
import DeviceManagementPage from '../features/settings/pages/DeviceManagementPage';
import ScreenLockPage from '../features/settings/pages/ScreenLockPage';
import FriendsSettingsPage from '../features/settings/pages/FriendsSettingsPage';
import BlockedFriendsPage from '../features/settings/pages/BlockedFriendsPage';
import ChatRoomSettingsPage from '../features/chat/pages/ChatRoomSettingsPage';
import NotificationSettingsPage from '../features/settings/pages/NotificationSettingsPage';
import DisplaySettingsPage from '../features/settings/pages/DisplaySettingsPage';
import FontSettingsPage from '../features/settings/pages/FontSettingsPage';
import WallpaperSettingsPage from '../features/settings/pages/WallpaperSettingsPage';
import CustomerServicePage from '../features/settings/pages/CustomerServicePage';
import ReportCenterPage from '../features/settings/pages/ReportCenterPage';
import HarmfulContentReportPage from '../features/settings/pages/HarmfulContentReportPage';
import CopyrightReportPage from '../features/settings/pages/CopyrightReportPage';
import IllegalContentReportPage from '../features/settings/pages/IllegalContentReportPage';

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

        {/* 독립 페이지들 */}
        <Route path="/chat/room/:chatId" element={<ChatRoomPage />} />
        <Route path="/chat/room/:chatId/settings" element={<ChatRoomSettingsPage />} />

        {/* 설정 페이지들 */}
        <Route path="/settings/account" element={<AccountInfoPage />} />
        <Route path="/settings/security" element={<SecurityPage />} />
        <Route path="/settings/security/privacy" element={<PrivacyManagementPage />} />
        <Route path="/settings/security/devices" element={<DeviceManagementPage />} />
        <Route path="/settings/security/lock" element={<ScreenLockPage />} />
        <Route path="/settings/friends" element={<FriendsSettingsPage />} />
        <Route path="/settings/friends/blocked" element={<BlockedFriendsPage />} />
        <Route path="/settings/notification" element={<NotificationSettingsPage />} />
        <Route path="/settings/display" element={<DisplaySettingsPage />} />
        <Route path="/settings/display/font" element={<FontSettingsPage />} />
        <Route path="/settings/display/wallpaper" element={<WallpaperSettingsPage />} />
        <Route path="/settings/help" element={<CustomerServicePage />} />
        <Route path="/settings/help/report" element={<ReportCenterPage />} />
        <Route path="/settings/help/report/harmful" element={<HarmfulContentReportPage />} />
        <Route path="/settings/help/report/copyright" element={<CopyrightReportPage />} />
        <Route path="/settings/help/report/illegal" element={<IllegalContentReportPage />} /> 

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