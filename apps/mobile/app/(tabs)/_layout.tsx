import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, View } from 'react-native';

import { TabBar } from '@/components/navigation/TabBar';
import { TabBarIcon } from '@/components/navigation/TabBarIcon';
import { tabConfig } from '@/components/navigation/tabConfig';
import { PaywallModal } from '@/components/subscription/PaywallModal';
import { useAuthStore } from '@/lib/auth/authStore';
import { hasFamilyGroup } from '@/lib/auth/helpers';

export default function TabLayout() {
  const { t } = useTranslation();
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
        {tabConfig.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: t(tab.titleKey),
              tabBarIcon: ({ focused }) => (
                <TabBarIcon name={tab.icon} focused={focused} testID={`${tab.testID}-icon`} />
              ),
            }}
          />
        ))}
      </Tabs>
      <PaywallModal />
    </>
  );
}
