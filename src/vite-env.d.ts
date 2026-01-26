/// <reference types="vite/client" />

// 이 파일을 모듈로 인식하도록 빈 export를 추가합니다.
export {};

declare global {
  interface Window {
    naver: any;
  }
}