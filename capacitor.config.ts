import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mychatapp.app',
  appName: 'MyChatApp',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;