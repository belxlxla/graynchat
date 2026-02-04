import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'; 
import { Toaster, toast } from 'react-hot-toast'; 
import { AuthProvider, useAuth } from '../features/auth/contexts/AuthContext';

import Splash from '../features/auth/components/Splash';
import LoginPage from '../features/auth/pages/LoginPage';
import SignUpPage from '../features/auth/pages/SignUpPage'; 
import PhoneAuthPage from '../features/auth/pages/PhoneAuthPage';
import ProfileSetupPage from '../features/auth/pages/ProfileSetupPage';
import RecoveryPage from '../features/auth/pages/RecoveryPage';
import FriendsListPage from '../features/chat/pages/FriendsListPage';
import ChatListPage from '../features/chat/pages/ChatListPage';
import ChatRoomPage from '../features/chat/pages/ChatRoomPage';
import SettingsPage from '../features/settings/pages/SettingsPage';
import AccountInfoPage from '../features/settings/pages/AccountInfoPage';
import SecurityPage from '../features/settings/pages/SecurityPage';
import PrivacyManagementPage from '../features/settings/pages/PrivacyManagementPage';
import AccountSecurityPage from '../features/settings/pages/AccountSecurityPage';
import DeviceManagementPage from '../features/settings/pages/DeviceManagementPage';
import ScreenLockPage from '../features/settings/pages/ScreenLockPage';
import TwoFactorAuthPage from '../features/settings/pages/TwoFactorAuthPage';
import PasswordChangePage from '../features/settings/pages/PasswordChangePage';
import WithdrawPage from '../features/settings/pages/WithdrawPage';
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
import CopyrightReportPage from '../features/settings/pages/CopyrightReportPage';
import HarmfulContentReportPage from '../features/settings/pages/HarmfulContentReportPage'; // ✅ 추가됨
import MainLayout from '../components/layout/MainLayout';

import ContentsPage from '../features/contents/pages/ContentsPage';
import ReportResultPage from '../features/contents/pages/ReportResultPage';

import TimeCapsuleCreatePage from '../features/time-capsule/pages/TimeCapsuleCreatePage';
import TimeCapsuleSentPage from '../features/time-capsule/pages/TimeCapsuleSentPage';
import TimeCapsuleEditPage from '../features/time-capsule/pages/TimeCapsuleEditPage';
import TimeCapsuleInboxPage from '../features/time-capsule/pages/TimeCapsuleInboxPage';
import TimeCapsuleViewPage from '../features/time-capsule/pages/TimeCapsuleViewPage';

import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';

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
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const initPushNotifications = async () => {
      
      if (Capacitor.getPlatform() === 'android') {
        await PushNotifications.createChannel({
          id: 'halfstep_default_channel',
          name: '일반 알림',
          description: '채팅 및 매칭 알림을 받습니다.',
          importance: 4,
          visibility: 1,
          vibration: true,
        });
      }

      if (Capacitor.getPlatform() === 'ios') {
        await PushNotifications.removeAllDeliveredNotifications();
      }

      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('푸시 알림 권한이 거부되었습니다.');
        return;
      }

      await PushNotifications.register();
    };

    initPushNotifications();

    const registrationListener = PushNotifications.addListener('registration', token => {
      console.log('🔥 나의 FCM 토큰:', token.value);
    });

    const registrationErrorListener = PushNotifications.addListener('registrationError', error => {
      console.error('푸시 토큰 발급 실패:', error);
    });

    const notificationReceivedListener = PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('알림 수신:', notification);
      
      toast(notification.title || '새 알림', {
        icon: '🔔',
        style: {
          background: '#333',
          color: '#fff',
        },
        duration: 4000,
      });
    });

    const notificationActionListener = PushNotifications.addListener('pushNotificationActionPerformed', notification => {
      console.log('알림 클릭해서 들어옴:', notification);
      
      const data = notification.notification.data;
      if (data.chatId) {
        navigate(`/chat/room/${data.chatId}`);
      } 
    });

    return () => {
      registrationListener.then(listener => listener.remove());
      registrationErrorListener.then(listener => listener.remove());
      notificationReceivedListener.then(listener => listener.remove());
      notificationActionListener.then(listener => listener.remove());
    };
  }, [navigate]); 

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
        <Route path="/auth/phone" element={<PhoneAuthPage />} />
        <Route path="/auth/phone-verify" element={<PhoneAuthPage />} />
        <Route path="/auth/profile-setup" element={<ProfileSetupPage />} />

        <Route path="/main" element={<MainLayout />}>
          <Route index element={<Navigate to="friends" replace />} />
          <Route path="friends" element={<FriendsListPage />} />
          <Route path="chats" element={<ChatListPage />} />
          <Route path="contents" element={<ContentsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="/main/contents/report" element={<ReportResultPage />} />

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
        <Route path="/settings/help/report/copyright" element={<CopyrightReportPage />} />
        <Route path="/settings/help/report/harmful" element={<HarmfulContentReportPage />} /> {/* ✅ 추가됨 */}
        <Route path="/time-capsule/create" element={<TimeCapsuleCreatePage />} />
        <Route path="/time-capsule/sent" element={<TimeCapsuleSentPage />} />
        <Route path="/time-capsule/edit/:id" element={<TimeCapsuleEditPage />} />
        <Route path="/time-capsule/inbox" element={<TimeCapsuleInboxPage />} />
        <Route path="/time-capsule/view/:id" element={<TimeCapsuleViewPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/main/friends" replace />} />
    </Routes>
  );
}

export default function App() {
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