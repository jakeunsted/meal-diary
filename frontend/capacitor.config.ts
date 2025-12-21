import type { CapacitorConfig } from '@capacitor/cli';

// Determine server URL based on environment
// Priority: CAPACITOR_SERVER_URL env var > CAPACITOR_DEV env var > NODE_ENV
const getServerUrl = (): string | undefined => {
  // Explicit server URL override (highest priority)
  if (process.env.CAPACITOR_SERVER_URL) {
    return process.env.CAPACITOR_SERVER_URL;
  }

  // Explicit dev mode flag
  if (process.env.CAPACITOR_DEV === 'true') {
    // Default to Android emulator address, but can be overridden with CAPACITOR_SERVER_URL
    return process.env.CAPACITOR_SERVER_URL || 'http://10.0.2.2:3000';
  }

  // Check NODE_ENV as fallback
  if (process.env.NODE_ENV === 'development') {
    return process.env.CAPACITOR_SERVER_URL || 'http://10.0.2.2:3000';
  }

  // Production: return undefined to use production URL
  return undefined;
};

const serverUrl = getServerUrl();

// Log the server URL being used (visible when running capacitor sync/copy)
const finalServerUrl = serverUrl || 'https://mealdiary.co.uk';
console.log('🔌 Capacitor Server URL:', finalServerUrl);
console.log('📱 Environment:', process.env.NODE_ENV || 'production');
console.log('🔧 CAPACITOR_SERVER_URL:', process.env.CAPACITOR_SERVER_URL || 'not set');
console.log('🔧 CAPACITOR_DEV:', process.env.CAPACITOR_DEV || 'not set');

const config: CapacitorConfig = {
  appId: 'com.mealdiary.app',
  appName: 'meal-diary',
  webDir: '.output/public',
  server: serverUrl
    ? {
        // Development mode: connect to local dev server
        // - Android emulator: http://10.0.2.2:3000
        // - Physical Android device: http://<your-local-ip>:3000 (e.g., http://192.168.1.100:3000)
        // - iOS simulator: http://127.0.0.1:3000
        // Set CAPACITOR_SERVER_URL env var to override
        url: serverUrl,
        cleartext: true
      }
    : {
        // Production mode: use production URL
        url: 'https://mealdiary.co.uk',
        cleartext: true
      },
  plugins: {
    SocialLogin: {
      providers: {
        google: true,
        facebook: false, // Disable unused providers to reduce app size
        apple: false,
        twitter: false
      }
    }
  }
};

export default config;
