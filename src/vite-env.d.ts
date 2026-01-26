/// <reference types="vite/client" />

// 모듈 스코프로 만들어 충돌 방지
export {};

declare global {
  interface Window {
    naver: any; // 전역 Window 객체에 naver 속성 확장
  }
}