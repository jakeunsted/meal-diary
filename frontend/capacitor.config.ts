import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mealdiary.app',
  appName: 'meal-diary',
  webDir: '.output/public',
  server: {
    // Use 10.0.2.2 for Android emulator to access host machine's localhost
    // Use 127.0.0.1 for iOS simulator
    url: process.env.NODE_ENV === 'development' 
      ? process.env.CAPACITOR_SERVER_URL || 'http://10.0.2.2:3000'
      : 'https://mealdiary.co.uk',
    cleartext: true
  }
};

export default config;
