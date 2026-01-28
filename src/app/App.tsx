import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';

// ✨ Auth Context
import { AuthProvider, useAuth } from '../features/auth/contexts/AuthContext';

// Auth Components & Pages
import Splash from '../features/auth/components/Splash';
import LoginPage from '../features/auth/pages/LoginPage';
import SignUpPage from '../features/auth/pages/SignUpPage'; // ✨ SignUpPage 임포트 확인
import PhoneAuthPage from '../features/auth/pages/PhoneAuthPage';
import ProfileSetupPage from '../features/auth/pages/ProfileSetupPage';

// Main Pages
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

// 1. 로그인한 사용자만 접근 가능한 라우트 (보호된 라우트)
function PrivateRoute() {
  const { user, loading } = useAuth();
  
  if (loading) return null; // 로딩 중일 때 빈 화면 (스피너 등)
  
  // 유저가 없으면 로그인 페이지로 리다이렉트
  return user ? <Outlet /> : <Navigate to="/auth/login" replace />;
}

// 2. 로그인 안 한 사용자만 접근 가능한 라우트 (로그인 페이지 등)
function PublicRoute() {
  const { user, loading } = useAuth();
  
  if (loading) return null;

  // 이미 로그인했으면 메인으로 리다이렉트
  return !user ? <Outlet /> : <Navigate to="/main/friends" replace />;
}

// 3. 앱의 메인 로직
function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const { loading } = useAuth();

  // 스플래시 화면 처리
  if (showSplash) {
    return <Splash onFinish={() => setShowSplash(false)} />;
  }

  // 인증 정보 로딩 중일 때 (깜빡임 방지)
  if (loading) {
    return <div className="h-screen bg-dark-bg" />;
  }

  return (
    <Routes>
      {/* === Public Routes (로그인 안 했을 때만 접근 가능) === */}
      <Route element={<PublicRoute />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/signup" element={<SignUpPage />} /> {/* ✨ 회원가입 경로 추가 */}
        <Route path="/auth/phone" element={<PhoneAuthPage />} />
        <Route path="/auth/profile" element={<ProfileSetupPage />} />
      </Route>

      {/* === Private Routes (로그인 해야만 접근 가능) === */}
      <Route element={<PrivateRoute />}>
        {/* 메인 탭 화면 (MainLayout 내부) */}
        <Route path="/main" element={<MainLayout />}>
          <Route index element={<Navigate to="friends" replace />} />
          <Route path="friends" element={<FriendsListPage />} />
          <Route path="chats" element={<ChatListPage />} />
          <Route path="contents" element={<Placeholder title="그레인 콘텐츠" />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* 독립 페이지들 (채팅방 등) */}
        <Route path="/chat/room/:chatId" element={<ChatRoomPage />} />
        <Route path="/chat/room/:chatId/settings" element={<ChatRoomSettingsPage />} />

        {/* 설정 하위 페이지들 */}
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
      </Route>

      {/* 잘못된 경로는 홈으로 리다이렉트 */}
      <Route path="*" element={<Navigate to="/main/friends" replace />} />
    </Routes>
  );
}

// 4. 최상위 컴포넌트에서 Provider 감싸기
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster 
          position="top-center" 
          toastOptions={{ style: { background: '#333', color: '#fff' } }} 
        />
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;