import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'; 
import { Toaster, toast } from 'react-hot-toast'; 
import { AuthProvider, useAuth } from '../features/auth/contexts/AuthContext';

// --- [기존 페이지 import 유지] ---
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
import MainLayout from '../components/layout/MainLayout';

// --- [STEP 5 핵심: Capacitor 라이브러리 추가] ---
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

// 실제로 라우팅과 로직을 담당하는 컴포넌트
function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const { loading } = useAuth(); 
  const navigate = useNavigate(); // 페이지 이동 훅

  // -------------------------------------------------------------------------
  // [푸시 알림 로직 시작] - 안드로이드 채널 & iOS 배지 로직 추가됨
  // -------------------------------------------------------------------------
  useEffect(() => {
    // 1. 웹 브라우저(PC/모바일웹)에서는 실행하지 않고, 앱일 때만 실행
    if (!Capacitor.isNativePlatform()) return;

    const initPushNotifications = async () => {
      
      // [A] 안드로이드 전용: 알림 채널 생성 (소리/진동 필수 설정)
      if (Capacitor.getPlatform() === 'android') {
        await PushNotifications.createChannel({
          id: 'halfstep_default_channel', // AndroidManifest.xml과 일치해야 함
          name: '일반 알림', // 사용자 설정 화면에 보일 이름
          description: '채팅 및 매칭 알림을 받습니다.',
          importance: 4, // 4: 높음 (소리+진동), 5: 매우높음 (헤드업 알림)
          visibility: 1,
          vibration: true,
        });
      }

      // [B] iOS 전용: 앱 실행 시 아이콘 배지 숫자 초기화
      if (Capacitor.getPlatform() === 'ios') {
        await PushNotifications.removeAllDeliveredNotifications();
      }

      // 2. 권한 확인 (granted: 허용됨, denied: 거절됨, prompt: 아직 안 물어봄)
      let permStatus = await PushNotifications.checkPermissions();

      // 아직 안 물어봤으면 권한 요청 팝업 띄우기
      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      // 권한이 없으면 중단
      if (permStatus.receive !== 'granted') {
        console.log('푸시 알림 권한이 거부되었습니다.');
        return;
      }

      // 3. FCM 서버에 기기 등록 (이때 토큰 발급 요청이 날아감)
      await PushNotifications.register();
    };

    // 로직 실행
    initPushNotifications();

    // 4. [리스너 1] 토큰 발급 성공 시 실행되는 코드
    const registrationListener = PushNotifications.addListener('registration', token => {
      console.log('🔥 나의 FCM 토큰:', token.value);
      // ★ 중요: 나중에 백엔드 개발 시, 여기서 user.id와 token.value를 서버로 보내 저장해야 함
      // 예: if (user) api.saveToken(user.id, token.value);
    });

    // 5. [리스너 2] 토큰 발급 실패 시
    const registrationErrorListener = PushNotifications.addListener('registrationError', error => {
      console.error('푸시 토큰 발급 실패:', error);
    });

    // 6. [리스너 3] 앱을 '보고 있을 때(Foreground)' 알림이 오면 실행
    const notificationReceivedListener = PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('알림 수신:', notification);
      
      // 상단 알림창 대신 앱 내 예쁜 토스트 메시지 띄우기
      toast(notification.title || '새 알림', {
        icon: '🔔',
        style: {
          background: '#333',
          color: '#fff',
        },
        duration: 4000,
      });
    });

    // 7. [리스너 4] 알림을 '클릭'해서 앱에 들어왔을 때 실행
    const notificationActionListener = PushNotifications.addListener('pushNotificationActionPerformed', notification => {
      console.log('알림 클릭해서 들어옴:', notification);
      
      // 알림 데이터에 chatId가 있으면 해당 채팅방으로 바로 이동
      const data = notification.notification.data;
      if (data.chatId) {
        navigate(`/chat/room/${data.chatId}`);
      } 
    });

    // 8. 클린업 (페이지 이동 시 리스너 삭제하여 메모리 누수 방지)
    return () => {
      registrationListener.then(listener => listener.remove());
      registrationErrorListener.then(listener => listener.remove());
      notificationReceivedListener.then(listener => listener.remove());
      notificationActionListener.then(listener => listener.remove());
    };
  }, [navigate]); 
  // -------------------------------------------------------------------------
  // [푸시 알림 로직 끝]
  // -------------------------------------------------------------------------

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
      {/* 기존 라우트 설정 유지 */}
      <Route element={<PublicRoute />}>
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/signup" element={<SignUpPage />} />
        <Route path="/auth/recovery" element={<RecoveryPage />} />
      </Route>

      <Route element={<PrivateRoute />}>
        <Route path="/auth/phone" element={<PhoneAuthPage />} />
        <Route path="/auth/profile-setup" element={<ProfileSetupPage />} />

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