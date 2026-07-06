const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3001';
const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://mealdiary.co.uk';

export const env = {
  apiUrl,
  webUrl,
} as const;
