// src/types/global.d.ts
export {};

// 네이버 유저 정보 타입 정의
interface NaverUser {
  email: string;
  name: string;
  id: string;
  profile_image: string;
  age?: string;
  birthday?: string;
  gender?: string;
  nickname?: string;
}

// 네이버 로그인 인스턴스 타입 정의
interface NaverLoginInstance {
  user: NaverUser;
  init: () => void;
  getLoginStatus: (callback: (status: boolean) => void) => void;
}

// Window 객체 확장
declare global {
  interface Window {
    // any 대신 구체적인 타입 사용 또는 unknown 사용 후 타입 단언
    naver: {
      LoginWithNaverId: new (options: {
        clientId: string;
        callbackUrl: string;
        isPopup: boolean;
        loginButton: { color: string; type: number; height: number };
      }) => NaverLoginInstance;
    };
  }
}