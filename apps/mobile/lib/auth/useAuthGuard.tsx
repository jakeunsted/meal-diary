import { Redirect, useSegments, type Href } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '@/lib/auth/authStore';
import { getPostAuthRoute } from '@/lib/auth/helpers';

interface AuthGuardResult {
  redirect: Href | null;
  isLoading: boolean;
}

export function useAuthGuard(): AuthGuardResult {
  const segments = useSegments();
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'loading') {
    return { redirect: null, isLoading: true };
  }

  const segmentList = segments as string[];
  const isStep2 = segmentList.includes('step-2');
  const isPublicAuthRoute = !isStep2;

  if (status === 'signedIn' && isPublicAuthRoute) {
    return { redirect: getPostAuthRoute(user), isLoading: false };
  }

  if (status === 'signedOut' && isStep2) {
    return { redirect: '/(auth)/login', isLoading: false };
  }

  return { redirect: null, isLoading: false };
}

export function AuthGuardSpinner() {
  return (
    <View className="flex-1 items-center justify-center bg-base">
      <ActivityIndicator size="large" color="#6366F1" />
    </View>
  );
}

export function AuthGuardRedirect({ href }: { href: Href }) {
  return <Redirect href={href} />;
}
