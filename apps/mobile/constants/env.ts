export const PRODUCTION_API_URL = 'https://api.mealdiary.co.uk';
export const PRODUCTION_WEB_URL = 'https://app.mealdiary.co.uk';
export const DEVELOPMENT_API_URL = 'http://10.0.2.2:3001';

interface ResolvePublicUrlsInput {
  apiUrl?: string;
  webUrl?: string;
  isDev: boolean;
}

const LOCAL_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '10.0.2.2',
  'dev-app.mealdiary.co.uk',
]);

const isLocalHostUrl = (url: string): boolean => {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
};

// Android release builds block cleartext HTTP; production API is HTTPS-only.
const forceHttpsProductionApi = (url: string): string =>
  url.replace(/^http:\/\/api\.mealdiary\.co\.uk(?::\d+)?/, PRODUCTION_API_URL);

export const resolvePublicUrls = ({
  apiUrl,
  webUrl,
  isDev,
}: ResolvePublicUrlsInput): { apiUrl: string; webUrl: string } => {
  let resolvedApi = forceHttpsProductionApi(apiUrl || (isDev ? DEVELOPMENT_API_URL : PRODUCTION_API_URL));
  let resolvedWeb = webUrl || PRODUCTION_WEB_URL;

  // `.env.local` outranks `.env.production` in Expo. Release bundles must not
  // keep emulator / nginx-dev hosts even if those files leak into the build.
  if (!isDev) {
    if (isLocalHostUrl(resolvedApi)) {
      resolvedApi = PRODUCTION_API_URL;
    }
    if (isLocalHostUrl(resolvedWeb)) {
      resolvedWeb = PRODUCTION_WEB_URL;
    }
  }

  return { apiUrl: resolvedApi, webUrl: resolvedWeb };
};

const { apiUrl, webUrl } = resolvePublicUrls({
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  webUrl: process.env.EXPO_PUBLIC_WEB_URL,
  isDev: __DEV__,
});
const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ?? '';
const googleRedirectUri = process.env.EXPO_PUBLIC_GOOGLE_REDIRECT_URI ?? '';
const posthogKey = process.env.EXPO_PUBLIC_POSTHOG_KEY ?? '';
const posthogHost =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://prxhg.mealdiary.co.uk';
const revenueCatAndroidApiKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY ?? '';
const revenueCatIosApiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';

export const env = {
  apiUrl,
  webUrl,
  googleWebClientId,
  googleAndroidClientId,
  googleRedirectUri,
  posthogKey,
  posthogHost,
  revenueCatAndroidApiKey,
  revenueCatIosApiKey,
  isGoogleConfigured: googleWebClientId.length > 0,
  isRevenueCatConfigured:
    revenueCatAndroidApiKey.length > 0 || revenueCatIosApiKey.length > 0,
} as const;
