import { Stack } from 'expo-router';

import {
  AuthGuardRedirect,
  AuthGuardSpinner,
  useAuthGuard,
} from '@/lib/auth/useAuthGuard';

export default function AuthLayout() {
  const { redirect, isLoading } = useAuthGuard();

  if (isLoading) {
    return <AuthGuardSpinner />;
  }

  if (redirect) {
    return <AuthGuardRedirect href={redirect} />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#1A1F2E' } }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="registration/step-1" />
      <Stack.Screen name="registration/step-2" />
    </Stack>
  );
}
