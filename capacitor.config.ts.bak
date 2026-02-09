import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'vns.grayn.app',
  appName: 'GRAYN',
  webDir: 'dist',
  // ✅ 아래 plugins 부분을 추가해서 네이티브 스플래시를 제어합니다.
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,      // 시스템 스플래시가 뜨는 시간을 0초로 (즉시 통과)
      launchAutoHide: true,       // 자동으로 숨김
      backgroundColor: "#1C1C1E", // 배경색을 앱 테마와 맞춤 (어두운 색)
      androidScaleType: "CENTER_CROP"
    }
  }
};

export default config;