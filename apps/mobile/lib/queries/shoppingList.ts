import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { apiFetch, ApiError } from '@/lib/api/client';
import {
  loadShoppingListCache,
  saveShoppingListCache,
} from '@/lib/shopping-list/shoppingListStorage';
import type { ShoppingList, ShoppingListItem } from '@/types/shoppingList';

const SHOPPING_LIST_STALE_MS = 5 * 60 * 1000;

export const shoppingListKeys = {
  all: ['shoppingList'] as const,
  family: (familyGroupId: number) => ['shoppingList', familyGroupId] as const,
};

export async function fetchShoppingList(familyGroupId: number): Promise<ShoppingList> {
  return apiFetch<ShoppingList>(`/shopping-list/${familyGroupId}`);
}

export async function addShoppingListItem(
  familyGroupId: number,
  payload: { name: string; parent_item_id?: number | null }
): Promise<ShoppingListItem> {
  return apiFetch<ShoppingListItem>(`/shopping-list/${familyGroupId}/items`, {
    method: 'POST',
    body: payload,
  });
}

export async function deleteShoppingListItem(
  familyGroupId: number,
  itemId: number
): Promise<void> {
  await apiFetch<void>(`/shopping-list/${familyGroupId}/items/${itemId}`, {
    method: 'DELETE',
  });
}

function updateShoppingListItems(
  shoppingList: ShoppingList | undefined,
  updater: (items: ShoppingListItem[]) => ShoppingListItem[]
): ShoppingList | undefined {
  if (!shoppingList) {
    return shoppingList;
  }

  return {
    ...shoppingList,
    items: updater(shoppingList.items),
  };
}

async function fetchShoppingListWithCache(familyGroupId: number): Promise<ShoppingList> {
  try {
    const shoppingList = await fetchShoppingList(familyGroupId);
    await saveShoppingListCache(familyGroupId, shoppingList);
    return shoppingList;
  } catch (error) {
    const cached = await loadShoppingListCache(familyGroupId);
    if (cached) {
      return cached.shoppingList;
    }
    throw error;
  }
}

export function useShoppingListQuery(familyGroupId: number | undefined) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!familyGroupId) {
      return;
    }

    const queryKey = shoppingListKeys.family(familyGroupId);
    if (queryClient.getQueryData(queryKey)) {
      return;
    }

    void (async () => {
      const cached = await loadShoppingListCache(familyGroupId);
      if (!cached) {
        return;
      }

      queryClient.setQueryData(queryKey, cached.shoppingList);
    })();
  }, [familyGroupId, queryClient]);

  return useQuery({
    queryKey: shoppingListKeys.family(familyGroupId ?? 0),
    queryFn: () => fetchShoppingListWithCache(familyGroupId!),
    enabled: !!familyGroupId,
    staleTime: SHOPPING_LIST_STALE_MS,
  });
}

export function resolveShoppingListErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load shopping list';
}

export function useAddShoppingListItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyGroupId,
      name,
      parentItemId = null,
    }: {
      familyGroupId: number;
      name: string;
      parentItemId?: number | null;
    }) =>
      addShoppingListItem(familyGroupId, {
        name,
        parent_item_id: parentItemId,
      }),
    onSuccess: (newItem, { familyGroupId }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);

      queryClient.setQueryData<ShoppingList>(queryKey, (shoppingList) => {
        const next = updateShoppingListItems(shoppingList, (items) => [...items, newItem]);
        if (next) {
          void saveShoppingListCache(familyGroupId, next);
        }
        return next;
      });
    },
  });
}

export function useDeleteShoppingListItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyGroupId,
      itemId,
    }: {
      familyGroupId: number;
      itemId: number;
    }) => deleteShoppingListItem(familyGroupId, itemId),
    onSuccess: (_, { familyGroupId, itemId }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);

      queryClient.setQueryData<ShoppingList>(queryKey, (shoppingList) => {
        const next = updateShoppingListItems(shoppingList, (items) =>
          items.filter((item) => item.id !== itemId)
        );
        if (next) {
          void saveShoppingListCache(familyGroupId, next);
        }
        return next;
      });
    },
  });
}
