import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'vns.grayn.app',
  appName: 'GRAYN',
  webDir: 'dist',
  ios: {
    contentInset: 'never',
    backgroundColor: '#0d0d0d',
  },
  android: {
    backgroundColor: '#0d0d0d',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#0d0d0d",
      androidScaleType: "CENTER_CROP"
    }
  }
};
export default config;