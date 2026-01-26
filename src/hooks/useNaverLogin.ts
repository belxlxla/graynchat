import { useEffect } from 'react';

const NAVER_CLIENT_ID = 'rKU793HIwCl3TzqdHcvj'; // ✨ 발급받은 Client ID로 변경 필요
const NAVER_CALLBACK_URL = 'https://aofftrusrbvcuvknngei.supabase.co'; // ✨ 설정한 Callback URL

export const useNaverLogin = () => {
  useEffect(() => {
    // 1. 네이버 SDK가 로드되었는지 확인
    if (!window.naver) {
      console.warn('Naver SDK not loaded yet.');
      return;
    }

    // 2. 이미 초기화되었다면 중복 실행 방지
    const naverLogin = new window.naver.LoginWithNaverId({
      clientId: NAVER_CLIENT_ID,
      callbackUrl: NAVER_CALLBACK_URL,
      isPopup: false,
      loginButton: { color: 'green', type: 3, height: 50 }, // 버튼 스타일
    });

    try {
      naverLogin.init();
      console.log('Naver Login Initialized');
    } catch (err) {
      console.error('Naver Login Init Error:', err);
    }
  }, []);
};