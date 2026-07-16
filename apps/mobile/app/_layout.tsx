import { Inter_400Regular, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import { colors } from '@/constants/theme';
import '@/global.css';
import '@/lib/i18n';
import { setSessionExpiredHandler } from '@/lib/api/client';
import { queryClient } from '@/lib/api/queryClient';
import { useAuthStore } from '@/lib/auth/authStore';
import { useAuthResume } from '@/lib/auth/useAuthResume';
import { useShoppingListSync } from '@/lib/shopping-list/useShoppingListSync';
import { useFamilyRealtime } from '@/lib/realtime/useFamilyRealtime';

if (Platform.OS !== 'web') {
  require('react-native-gesture-handler');
  require('react-native-reanimated');
}

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const router = useRouter();
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const familyGroupId = useAuthStore((state) => state.user?.family_group_id);

  useAuthResume();
  useFamilyRealtime();
  useShoppingListSync(familyGroupId ?? undefined);

  useEffect(() => {
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      router.replace('/(auth)/login');
    });
    return () => setSessionExpiredHandler(null);
  }, [router]);

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.base } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="terms" />
      <Stack.Screen name="support" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      void SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <GluestackUIProvider mode="dark">
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
