import { PushNotifications } from '@capacitor/push-notifications';
import type { Token, PushNotificationSchema } from '@capacitor/push-notifications';
import { supabase } from '../lib/supabaseClient';

export const initializePushNotifications = async () => {
  try {
    // 권한 요청
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('알림 권한이 거부되었습니다');
      return;
    }

    // FCM 등록
    await PushNotifications.register();

    // 리스너 설정
    setupPushListeners();

  } catch (error) {
    console.error('푸시 알림 초기화 실패:', error);
  }
};

const setupPushListeners = () => {
  // 토큰 등록 성공
  PushNotifications.addListener('registration', async (token: Token) => {
    console.log('FCM Token:', token.value);
    
    // Supabase에 토큰 저장
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await saveFCMToken(user.id, token.value);
    }
  });

  // 토큰 등록 실패
  PushNotifications.addListener('registrationError', (error: any) => {
    console.error('토큰 등록 실패:', error);
  });

  // 푸시 알림 수신 (포그라운드)
  PushNotifications.addListener(
    'pushNotificationReceived',
    (notification: PushNotificationSchema) => {
      console.log('푸시 알림 수신:', notification);
    }
  );

  // 푸시 알림 클릭
  PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (notification: any) => {
      console.log('푸시 알림 클릭:', notification);
      const data = notification.notification.data;
      console.log('전달받은 데이터:', data);
    }
  );
};

const saveFCMToken = async (userId: string, token: string) => {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ fcm_token: token })
      .eq('id', userId);

    if (error) throw error;
    console.log('FCM 토큰 저장 완료');
  } catch (error) {
    console.error('FCM 토큰 저장 실패:', error);
  }
};