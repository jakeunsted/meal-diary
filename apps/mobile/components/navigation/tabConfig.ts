import type { ComponentProps } from 'react';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';

export interface TabConfigItem {
  name: string;
  titleKey: 'tabs.diary' | 'tabs.recipes' | 'tabs.shoppingList' | 'tabs.profile';
  icon: ComponentProps<typeof FontAwesome6>['name'];
  testID: string;
}

export const tabConfig: TabConfigItem[] = [
  {
    name: 'diary',
    titleKey: 'tabs.diary',
    icon: 'house',
    testID: 'nav-diary',
  },
  {
    name: 'recipes',
    titleKey: 'tabs.recipes',
    icon: 'book-open',
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
    icon: 'circle-user',
    testID: 'nav-profile',
  },
];
