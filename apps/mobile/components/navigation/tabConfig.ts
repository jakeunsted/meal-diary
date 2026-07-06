import type { ComponentProps } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export interface TabConfigItem {
  name: string;
  titleKey: 'tabs.diary' | 'tabs.recipes' | 'tabs.shoppingList' | 'tabs.profile';
  icon: ComponentProps<typeof FontAwesome>['name'];
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
    icon: 'user-circle',
    testID: 'nav-profile',
  },
];
