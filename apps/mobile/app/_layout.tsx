import { Inter_400Regular, Inter_600SemiBold, useFonts } from '@expo-google-fonts/inter';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '@/global.css';
import '@/lib/i18n';
import { queryClient } from '@/lib/api/queryClient';

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

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
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
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#1A1F2E' } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)" />
          </Stack>
        </SafeAreaProvider>
      </QueryClientProvider>
    </GluestackUIProvider>
  );
}
