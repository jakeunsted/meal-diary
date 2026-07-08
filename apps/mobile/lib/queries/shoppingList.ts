import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
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

export async function updateShoppingListItem(
  familyGroupId: number,
  itemId: number,
  updates: { name?: string; checked?: boolean }
): Promise<ShoppingListItem> {
  return apiFetch<ShoppingListItem>(`/shopping-list/${familyGroupId}/items/${itemId}`, {
    method: 'PUT',
    body: updates,
  });
}

export interface BulkShoppingListItemUpdate {
  id: number;
  name?: string;
  checked?: boolean;
}

export async function bulkUpdateShoppingListItems(
  familyGroupId: number,
  items: BulkShoppingListItemUpdate[]
): Promise<ShoppingListItem[]> {
  return apiFetch<ShoppingListItem[]>(`/shopping-list/${familyGroupId}/items/bulk-update`, {
    method: 'PUT',
    body: { items },
  });
}

export async function bulkDeleteShoppingListItems(
  familyGroupId: number,
  ids: number[]
): Promise<void> {
  await apiFetch<void>(`/shopping-list/${familyGroupId}/items/bulk-delete`, {
    method: 'POST',
    body: { ids },
  });
}

function applyLocalItemUpdates(
  items: ShoppingListItem[],
  updates: { id: number | string; name?: string; checked?: boolean }[]
): ShoppingListItem[] {
  const updatesById = new Map(updates.map((update) => [update.id, update]));

  return items.map((item) => {
    const update = updatesById.get(item.id);
    if (!update) {
      return item;
    }

    return {
      ...item,
      ...(update.name !== undefined ? { name: update.name } : {}),
      ...(update.checked !== undefined ? { checked: update.checked } : {}),
    };
  });
}

function mergeServerItems(
  items: ShoppingListItem[],
  serverItems: ShoppingListItem[]
): ShoppingListItem[] {
  const serverItemsById = new Map(serverItems.map((item) => [item.id, item]));

  return items.map((item) => serverItemsById.get(item.id) ?? item);
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

export function setShoppingListQueryData(
  queryClient: QueryClient,
  familyGroupId: number,
  updater: (shoppingList: ShoppingList | undefined) => ShoppingList | undefined
): void {
  const queryKey = shoppingListKeys.family(familyGroupId);

  queryClient.setQueryData<ShoppingList>(queryKey, (shoppingList) => {
    const next = updater(shoppingList);
    if (next) {
      void saveShoppingListCache(familyGroupId, next);
    }
    return next;
  });
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
      replaceTempId?: number | string;
    }) =>
      addShoppingListItem(familyGroupId, {
        name,
        parent_item_id: parentItemId,
      }),
    onSuccess: (newItem, { familyGroupId, replaceTempId }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);

      queryClient.setQueryData<ShoppingList>(queryKey, (shoppingList) => {
        const next = updateShoppingListItems(shoppingList, (items) => {
          if (replaceTempId !== undefined) {
            const index = items.findIndex((item) => item.id === replaceTempId);
            if (index === -1) {
              return [...items, newItem];
            }
            const updated = [...items];
            updated[index] = newItem;
            return updated;
          }
          return [...items, newItem];
        });
        if (next) {
          void saveShoppingListCache(familyGroupId, next);
        }
        return next;
      });
    },
  });
}

export function useUpdateShoppingListItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyGroupId,
      itemId,
      updates,
    }: {
      familyGroupId: number;
      itemId: number;
      updates: { name?: string; checked?: boolean };
    }) => updateShoppingListItem(familyGroupId, itemId, updates),
    onSuccess: (updatedItem, { familyGroupId }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);

      queryClient.setQueryData<ShoppingList>(queryKey, (shoppingList) => {
        const next = updateShoppingListItems(shoppingList, (items) =>
          items.map((item) => (item.id === updatedItem.id ? updatedItem : item))
        );
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

export function useBulkUpdateShoppingListItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyGroupId,
      items,
    }: {
      familyGroupId: number;
      items: BulkShoppingListItemUpdate[];
    }) => bulkUpdateShoppingListItems(familyGroupId, items),
    onMutate: async ({ familyGroupId, items }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ShoppingList>(queryKey);
      const localUpdates = items.map((item) => ({ ...item }));

      queryClient.setQueryData<ShoppingList>(queryKey, (shoppingList) =>
        updateShoppingListItems(shoppingList, (listItems) =>
          applyLocalItemUpdates(listItems, localUpdates)
        )
      );

      return { previous };
    },
    onError: (_error, { familyGroupId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(shoppingListKeys.family(familyGroupId), context.previous);
      }
    },
    onSuccess: (serverItems, { familyGroupId }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);

      queryClient.setQueryData<ShoppingList>(queryKey, (shoppingList) => {
        const next = updateShoppingListItems(shoppingList, (items) =>
          mergeServerItems(items, serverItems)
        );
        if (next) {
          void saveShoppingListCache(familyGroupId, next);
        }
        return next;
      });
    },
  });
}

export function useBulkDeleteShoppingListItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyGroupId,
      ids,
    }: {
      familyGroupId: number;
      ids: number[];
    }) => bulkDeleteShoppingListItems(familyGroupId, ids),
    onMutate: async ({ familyGroupId, ids }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ShoppingList>(queryKey);
      const idSet = new Set(ids);

      queryClient.setQueryData<ShoppingList>(queryKey, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          items.filter((item) => typeof item.id !== 'number' || !idSet.has(item.id))
        )
      );

      return { previous };
    },
    onError: (_error, { familyGroupId }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(shoppingListKeys.family(familyGroupId), context.previous);
      }
    },
    onSuccess: (_, { familyGroupId }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);
      const shoppingList = queryClient.getQueryData<ShoppingList>(queryKey);
      if (shoppingList) {
        void saveShoppingListCache(familyGroupId, shoppingList);
      }
    },
  });
}
