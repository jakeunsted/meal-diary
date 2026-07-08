import { useCallback, useMemo } from 'react';

import { flattenShoppingListItems } from '@/lib/shopping-list/shoppingListTree';
import {
  resolveShoppingListErrorMessage,
  useShoppingListQuery,
} from '@/lib/queries/shoppingList';
import type { ShoppingList, ShoppingListItem } from '@/types/shoppingList';

export interface UseShoppingListResult {
  shoppingList: ShoppingList | null;
  orderedItems: ShoppingListItem[];
  activeItems: ShoppingListItem[];
  checkedItems: ShoppingListItem[];
  loading: boolean;
  isFetching: boolean;
  lastFetchError: string | null;
  refresh: () => Promise<unknown>;
}

export function useShoppingList(familyGroupId: number | undefined): UseShoppingListResult {
  const shoppingListQuery = useShoppingListQuery(familyGroupId);

  const shoppingList = shoppingListQuery.data ?? null;

  const orderedItems = useMemo(() => {
    if (!shoppingList?.items) {
      return [];
    }
    return flattenShoppingListItems(shoppingList.items);
  }, [shoppingList?.items]);

  const activeItems = useMemo(
    () => orderedItems.filter((item) => !item.checked),
    [orderedItems]
  );

  const checkedItems = useMemo(
    () => orderedItems.filter((item) => item.checked),
    [orderedItems]
  );

  const refresh = useCallback(() => {
    return shoppingListQuery.refetch();
  }, [shoppingListQuery]);

  return {
    shoppingList,
    orderedItems,
    activeItems,
    checkedItems,
    loading: shoppingListQuery.isLoading,
    isFetching: shoppingListQuery.isFetching,
    lastFetchError: shoppingListQuery.error
      ? resolveShoppingListErrorMessage(shoppingListQuery.error)
      : null,
    refresh,
  };
}
