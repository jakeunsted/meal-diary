import {
  groupShoppingListItemsByCategory,
  sortShoppingListItemsForDisplay,
  type ShoppingCategory,
} from '@meal-diary/shared';
import { useCallback, useMemo } from 'react';

import {
  resolveShoppingListErrorMessage,
  useShoppingListQuery,
} from '@/lib/queries/shoppingList';
import { resolveShoppingListItemCategory } from '@/lib/shopping-list/shoppingListTree';
import type { ShoppingList, ShoppingListItem } from '@/types/shoppingList';

export interface UseShoppingListResult {
  shoppingList: ShoppingList | null;
  orderedItems: ShoppingListItem[];
  activeItems: ShoppingListItem[];
  checkedItems: ShoppingListItem[];
  itemsByCategory: Record<ShoppingCategory, ShoppingListItem[]>;
  loading: boolean;
  isFetching: boolean;
  lastFetchError: string | null;
  refresh: () => Promise<unknown>;
}

function withResolvedCategories(items: ShoppingListItem[]): ShoppingListItem[] {
  return items.map((item) => ({
    ...item,
    category: resolveShoppingListItemCategory(item.category),
  }));
}

export function useShoppingList(familyGroupId: number | undefined): UseShoppingListResult {
  const shoppingListQuery = useShoppingListQuery(familyGroupId);

  const shoppingList = shoppingListQuery.data ?? null;

  const orderedItems = useMemo(() => {
    if (!shoppingList?.items) {
      return [];
    }
    return sortShoppingListItemsForDisplay(withResolvedCategories(shoppingList.items));
  }, [shoppingList?.items]);

  const activeItems = useMemo(
    () => orderedItems.filter((item) => !item.checked),
    [orderedItems]
  );

  const checkedItems = useMemo(
    () => orderedItems.filter((item) => item.checked),
    [orderedItems]
  );

  const itemsByCategory = useMemo(
    () => groupShoppingListItemsByCategory(withResolvedCategories(activeItems)),
    [activeItems]
  );

  const refresh = useCallback(() => {
    return shoppingListQuery.refetch();
  }, [shoppingListQuery]);

  return {
    shoppingList,
    orderedItems,
    activeItems,
    checkedItems,
    itemsByCategory,
    loading: shoppingListQuery.isLoading,
    isFetching: shoppingListQuery.isFetching,
    lastFetchError: shoppingListQuery.error
      ? resolveShoppingListErrorMessage(shoppingListQuery.error)
      : null,
    refresh,
  };
}
