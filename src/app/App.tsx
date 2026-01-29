import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// ✨ Auth Context
import { AuthProvider, useAuth } from '../features/auth/contexts/AuthContext';

// Auth Components & Pages
import Splash from '../features/auth/components/Splash';
import LoginPage from '../features/auth/pages/LoginPage';
import SignUpPage from '../features/auth/pages/SignUpPage'; 
import PhoneAuthPage from '../features/auth/pages/PhoneAuthPage';
import ProfileSetupPage from '../features/auth/pages/ProfileSetupPage';
import RecoveryPage from '../features/auth/pages/RecoveryPage';

// Main Pages
import FriendsListPage from '../features/chat/pages/FriendsListPage';
import ChatListPage from '../features/chat/pages/ChatListPage';
import ChatRoomPage from '../features/chat/pages/ChatRoomPage';
import SettingsPage from '../features/settings/pages/SettingsPage';
import AccountInfoPage from '../features/settings/pages/AccountInfoPage';

// Security Pages
import SecurityPage from '../features/settings/pages/SecurityPage';
import PrivacyManagementPage from '../features/settings/pages/PrivacyManagementPage';
import AccountSecurityPage from '../features/settings/pages/AccountSecurityPage';
import DeviceManagementPage from '../features/settings/pages/DeviceManagementPage';
import ScreenLockPage from '../features/settings/pages/ScreenLockPage';
import TwoFactorAuthPage from '../features/settings/pages/TwoFactorAuthPage';
import PasswordChangePage from '../features/settings/pages/PasswordChangePage';
import WithdrawPage from '../features/settings/pages/WithdrawPage';

// ✨ New Component
import AppLockOverlay from '../features/auth/components/AppLockOverlay';

import FriendsSettingsPage from '../features/settings/pages/FriendsSettingsPage';
import BlockedFriendsPage from '../features/settings/pages/BlockedFriendsPage';
import ChatRoomSettingsPage from '../features/chat/pages/ChatRoomSettingsPage';
import NotificationSettingsPage from '../features/settings/pages/NotificationSettingsPage';
import DisplaySettingsPage from '../features/settings/pages/DisplaySettingsPage';
import FontSettingsPage from '../features/settings/pages/FontSettingsPage';
import WallpaperSettingsPage from '../features/settings/pages/WallpaperSettingsPage';
import CustomerServicePage from '../features/settings/pages/CustomerServicePage';
import ReportCenterPage from '../features/settings/pages/ReportCenterPage';
import IllegalContentReportPage from '../features/settings/pages/IllegalContentReportPage'; 

import MainLayout from '../components/layout/MainLayout';

function PrivateRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen bg-[#1C1C1E]" />;
  return user ? <Outlet /> : <Navigate to="/auth/login" replace />;
}

function PublicRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="h-screen bg-[#1C1C1E]" />;
  return !user ? <Outlet /> : <Navigate to="/main/friends" replace />;
}

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const { loading } = useAuth();

  useEffect(() => {
    const savedTheme = localStorage.getItem('grayn_theme') || 'dark';
    const savedSize = localStorage.getItem('grayn_text_size') || '2';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(savedTheme);
    const baseFontSize = 14 + (Number(savedSize) * 1);
    document.documentElement.style.fontSize = `${baseFontSize}px`;
    document.body.style.backgroundColor = savedTheme === 'light' ? '#F2F2F7' : '#1C1C1E';
  }, []);

  if (showSplash) return <Splash onFinish={() => setShowSplash(false)} />;
  if (loading) return <div className="h-screen bg-[#1C1C1E]" />;

  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/signup" element={<SignUpPage />} />
        <Route path="/auth/recovery" element={<RecoveryPage />} />
      </Route>

      <Route element={<PrivateRoute />}>
        {/* ✨ 가입 절차 경로를 PrivateRoute 내부로 이동하여 튕김 현상 방지 */}
        <Route path="/auth/phone" element={<PhoneAuthPage onBackToLogin={() => window.history.back()} onNewUser={() => {}} />} />
        <Route path="/auth/profile" element={<ProfileSetupPage onComplete={() => {}} />} />

        <Route path="/main" element={<MainLayout />}>
          <Route index element={<Navigate to="friends" replace />} />
          <Route path="friends" element={<FriendsListPage />} />
          <Route path="chats" element={<ChatListPage />} />
          <Route path="contents" element={<div className="h-full flex items-center justify-center text-white">🚧 콘텐츠 준비 중</div>} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="/chat/room/:chatId" element={<ChatRoomPage />} />
        <Route path="/chat/room/:chatId/settings" element={<ChatRoomSettingsPage />} />

        <Route path="/settings/account" element={<AccountInfoPage />} />
        <Route path="/settings/account/withdraw" element={<WithdrawPage />} />

        <Route path="/settings/security" element={<SecurityPage />} />
        <Route path="/settings/security/privacy" element={<PrivacyManagementPage />} />
        <Route path="/settings/security/account" element={<AccountSecurityPage />} />
        <Route path="/settings/security/2fa" element={<TwoFactorAuthPage />} />
        <Route path="/settings/security/password" element={<PasswordChangePage />} />
        <Route path="/settings/security/manage" element={<DeviceManagementPage />} />
        <Route path="/settings/security/lock" element={<ScreenLockPage />} />

        <Route path="/settings/friends" element={<FriendsSettingsPage />} />
        <Route path="/settings/friends/blocked" element={<BlockedFriendsPage />} />
        <Route path="/settings/notification" element={<NotificationSettingsPage />} />
        <Route path="/settings/display" element={<DisplaySettingsPage />} />
        <Route path="/settings/display/font" element={<FontSettingsPage />} />
        <Route path="/settings/display/wallpaper" element={<WallpaperSettingsPage />} />
        <Route path="/settings/help" element={<CustomerServicePage />} />
        <Route path="/settings/help/report" element={<ReportCenterPage />} />
        <Route path="/settings/help/report/illegal" element={<IllegalContentReportPage />} /> 
      </Route>

      <Route path="*" element={<Navigate to="/main/friends" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff', borderRadius: '12px' } }} />
        <AppLockOverlay /> 
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;