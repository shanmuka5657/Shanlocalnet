import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.localnet.app',
  appName: 'LocalNet',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    allowNavigation: ['shanlocalnet.vercel.app', '*.s3.amazonaws.com', '*.amazonaws.com']
  }
};

export default config;
