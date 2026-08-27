import {
  SHOPPING_LIST_TABS,
  type ShoppingListTab,
} from '@meal-diary/shared';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView } from 'react-native';

import { Box } from '@/components/ui/box';
import { Text } from '@/components/ui/text';

interface ShoppingListCategoryTabsProps {
  value: ShoppingListTab;
  onChange: (tab: ShoppingListTab) => void;
  counts: Record<ShoppingListTab, number>;
}

function tabLabelKey(tab: ShoppingListTab): string {
  switch (tab) {
    case 'all':
      return 'shoppingList.all';
    case 'meat':
      return 'shoppingList.meat';
    case 'fruit_veg':
      return 'shoppingList.fruitVeg';
    case 'bakery':
      return 'shoppingList.bakery';
    case 'canned':
      return 'shoppingList.canned';
    case 'other':
      return 'shoppingList.other';
    default:
      return 'shoppingList.other';
  }
}

export function ShoppingListCategoryTabs({
  value,
  onChange,
  counts,
}: ShoppingListCategoryTabsProps) {
  const { t } = useTranslation();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-3"
      contentContainerClassName="gap-2 px-0"
      testID="shopping-list-category-tabs"
    >
      {SHOPPING_LIST_TABS.map((tab) => {
        const isActive = value === tab;
        const count = counts[tab] ?? 0;

        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            className={`flex-row items-center rounded-full px-3 py-2 ${
              isActive ? 'bg-primary' : 'bg-ice/10'
            }`}
            onPress={() => onChange(tab)}
            testID={`shopping-list-tab-${tab}`}
          >
            <Text className={`text-sm ${isActive ? 'text-ice font-semibold' : 'text-ice/80'}`}>
              {t(tabLabelKey(tab))}
            </Text>
            {count > 0 ? (
              <Box
                className={`ml-1.5 min-w-5 items-center rounded-full px-1.5 ${
                  isActive ? 'bg-ice/20' : 'bg-ice/10'
                }`}
                testID={`shopping-list-tab-count-${tab}`}
              >
                <Text className={`text-xs ${isActive ? 'text-ice' : 'text-ice/70'}`}>{count}</Text>
              </Box>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
