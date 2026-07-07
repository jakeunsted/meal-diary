import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { TabBar } from '@/components/navigation/TabBar';
import { PaywallModal } from '@/components/subscription/PaywallModal';
import { useAuthStore } from '@/lib/auth/authStore';
import { hasFamilyGroup } from '@/lib/auth/helpers';

export default function TabLayout() {
  const status = useAuthStore((state) => state.status);
  const user = useAuthStore((state) => state.user);

  if (status === 'loading') {
    return (
      <View className="flex-1 items-center justify-center bg-base">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  if (status === 'signedOut') {
    return <Redirect href="/(auth)/login" />;
  }

  if (!hasFamilyGroup(user)) {
    return <Redirect href="/(auth)/registration/step-2" />;
  }

  return (
    <>
      <Tabs
        tabBar={(props) => <TabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="diary" />
        <Tabs.Screen name="recipes" />
        <Tabs.Screen name="shopping-list" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <PaywallModal />
    </>
  );
}
