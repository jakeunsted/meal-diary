import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '@/lib/auth/authStore';
import { getPostAuthRoute } from '@/lib/auth/helpers';

export default function Index() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    void hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (status === 'signedIn') {
    return <Redirect href={getPostAuthRoute(user)} />;
  }

  return <Redirect href="/(auth)/login" />;
}
