const rawApiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3001';
// Android release builds block cleartext HTTP; production API is HTTPS-only.
const apiUrl = rawApiUrl.replace(
  /^http:\/\/api\.mealdiary\.co\.uk(?::\d+)?/,
  'https://api.mealdiary.co.uk'
);
const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://app.mealdiary.co.uk';
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const googleRedirectUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI ?? '';

export const env = {
  apiUrl,
  webUrl,
  googleWebClientId,
  googleAndroidClientId,
  googleRedirectUri,
  isGoogleConfigured: googleWebClientId.length > 0,
} as const;
