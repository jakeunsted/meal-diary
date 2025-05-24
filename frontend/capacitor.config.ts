import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mealdiary.app',
  appName: 'meal-diary',
  webDir: '.output/public',
  server: {
    // Use 10.0.2.2 to access host machine's localhost from Android emulator
    url: process.env.NODE_ENV === 'development' ? 'http://10.0.2.2:3000' : 'https://mealdiary.co.uk',
    cleartext: true
  }
};

export default config;
