const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3001';

export const env = {
  apiUrl,
} as const;
