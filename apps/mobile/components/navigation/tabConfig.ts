import FontAwesome from '@expo/vector-icons/FontAwesome';

import type { TabBarIconName } from '@/components/navigation/TabBarIcon';

export interface TabConfigItem {
  name: string;
  titleKey: 'tabs.diary' | 'tabs.recipes' | 'tabs.shoppingList' | 'tabs.profile';
  icon: TabBarIconName;
  testID: string;
}

export const tabConfig: TabConfigItem[] = [
  {
    name: 'diary',
    titleKey: 'tabs.diary',
    icon: 'home',
    testID: 'nav-diary',
  },
  {
    name: 'recipes',
    titleKey: 'tabs.recipes',
    icon: 'book',
    testID: 'nav-recipes',
  },
  {
    name: 'shopping-list',
    titleKey: 'tabs.shoppingList',
    icon: 'list',
    testID: 'nav-shopping-list',
  },
  {
    name: 'profile',
    titleKey: 'tabs.profile',
    icon: 'user',
    testID: 'nav-profile',
  },
];

export function normalizeTabRouteName(routeName: string): string {
  const withoutIndex = routeName.replace(/\/index$/, '');
  const segments = withoutIndex.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? routeName;
}

export function getTabConfig(routeName: string): TabConfigItem | undefined {
  const normalizedName = normalizeTabRouteName(routeName);
  return tabConfig.find((item) => item.name === routeName || item.name === normalizedName);
}
