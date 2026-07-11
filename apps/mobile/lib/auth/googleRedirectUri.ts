import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';

import { env } from '@/constants/env';

/** Google OAuth PKCE on web needs WebCrypto, which requires a secure origin (HTTPS or localhost). */
export function isGoogleWebSignInAvailable(): boolean {
  if (Platform.OS !== 'web') {
    return true;
  }

  return typeof window !== 'undefined' && window.isSecureContext;
}

/** Redirect URI sent to Google — must match an authorized URI on the Web OAuth client exactly. */
export function getGoogleRedirectUri(): string {
  if (env.googleRedirectUri) {
    return env.googleRedirectUri;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // makeRedirectUri() includes the current path (e.g. /login), which breaks unless
    // every route is registered in Google Cloud Console. Use origin only on web.
    return window.location.origin;
  }

  return makeRedirectUri({ scheme: 'mealdiary' });
}
