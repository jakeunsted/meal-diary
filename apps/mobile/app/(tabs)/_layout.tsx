import { Tabs } from 'expo-router';

import { TabBar } from '@/components/navigation/TabBar';

export default function TabLayout() {
  return (
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
  );
}
