import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { apiFetch, ApiError } from '@/lib/api/client';
import { isNetworkError } from '@/lib/auth/httpError';
import {
  ShoppingListOfflineQueuedError,
  isShoppingListOfflineQueuedError,
  shouldRollbackShoppingListOptimistic,
} from '@/lib/shopping-list/shoppingListOfflineError';
import {
  createPendingOpId,
  enqueuePendingOp,
} from '@/lib/shopping-list/shoppingListPendingQueue';
import { generateTempShoppingListItemId } from '@/lib/shopping-list/shoppingListTree';
import {
  loadShoppingListCache,
  saveShoppingListCache,
} from '@/lib/shopping-list/shoppingListStorage';
import type {
  ShoppingList,
  ShoppingListItem,
  ShoppingListPendingOp,
} from '@/types/shoppingList';

async function enqueueAndScheduleFlush(
  queryClient: QueryClient,
  op: ShoppingListPendingOp
): Promise<void> {
  await enqueuePendingOp(op);
  // Dynamic import avoids a circular dependency with shoppingListSync.
  void import('@/lib/shopping-list/shoppingListSync').then(({ flushShoppingListPendingOps }) =>
    flushShoppingListPendingOps(queryClient, op.familyGroupId)
  );
}

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

export interface BulkShoppingListItemPayload {
  name: string;
  parent_item_id?: number | null;
}

export async function bulkAddShoppingListItems(
  familyGroupId: number,
  items: BulkShoppingListItemPayload[]
): Promise<ShoppingListItem[]> {
  return apiFetch<ShoppingListItem[]>(`/shopping-list/${familyGroupId}/items/bulk`, {
    method: 'POST',
    body: { items },
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

export interface BulkShoppingListItemUpdateInput {
  id: number | string;
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

export interface ShoppingListReorderItem {
  id: number;
  parent_item_id: number | null;
  position: number;
}

export interface ShoppingListReorderItemInput {
  id: number | string;
  parent_item_id: number | string | null;
  position: number;
}

export async function reorderShoppingListItems(
  familyGroupId: number,
  items: ShoppingListReorderItem[]
): Promise<ShoppingListItem[]> {
  return apiFetch<ShoppingListItem[]>(`/shopping-list/${familyGroupId}/items/reorder`, {
    method: 'PUT',
    body: { items },
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

function persistOptimisticList(
  queryClient: QueryClient,
  familyGroupId: number
): void {
  const shoppingList = queryClient.getQueryData<ShoppingList>(
    shoppingListKeys.family(familyGroupId)
  );
  if (shoppingList) {
    void saveShoppingListCache(familyGroupId, shoppingList);
  }
}

function toNumericBulkUpdates(
  items: BulkShoppingListItemUpdateInput[]
): BulkShoppingListItemUpdate[] | null {
  if (items.some((item) => typeof item.id !== 'number')) {
    return null;
  }
  return items.map((item) => ({
    id: item.id as number,
    ...(item.name !== undefined ? { name: item.name } : {}),
    ...(item.checked !== undefined ? { checked: item.checked } : {}),
  }));
}

function toNumericReorderItems(
  items: ShoppingListReorderItemInput[]
): ShoppingListReorderItem[] | null {
  if (
    items.some(
      (item) =>
        typeof item.id !== 'number' ||
        (item.parent_item_id != null && typeof item.parent_item_id !== 'number')
    )
  ) {
    return null;
  }

  return items.map((item) => ({
    id: item.id as number,
    parent_item_id: item.parent_item_id as number | null,
    position: item.position,
  }));
}

function toNumericIds(ids: Array<number | string>): number[] | null {
  if (ids.some((id) => typeof id !== 'number')) {
    return null;
  }
  return ids as number[];
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
  if (isShoppingListOfflineQueuedError(error)) {
    return '';
  }
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
    mutationFn: async ({
      familyGroupId,
      name,
      parentItemId = null,
      replaceTempId,
    }: {
      familyGroupId: number;
      name: string;
      parentItemId?: number | string | null;
      replaceTempId?: number | string;
    }) => {
      const numericParent =
        parentItemId == null || typeof parentItemId === 'number' ? parentItemId : null;
      const canCallApi = parentItemId == null || typeof parentItemId === 'number';

      if (canCallApi) {
        try {
          return await addShoppingListItem(familyGroupId, {
            name,
            parent_item_id: numericParent,
          });
        } catch (error) {
          if (!isNetworkError(error)) {
            throw error;
          }
        }
      }

      const tempId =
        typeof replaceTempId === 'string'
          ? replaceTempId
          : generateTempShoppingListItemId();

      await enqueueAndScheduleFlush(queryClient, {
        opId: createPendingOpId(),
        type: 'add',
        familyGroupId,
        tempId,
        name,
        parentItemId: parentItemId ?? null,
      });

      throw new ShoppingListOfflineQueuedError(tempId);
    },
    onSuccess: (newItem, { familyGroupId, replaceTempId }) => {
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) => {
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
        })
      );
    },
    onError: (error, { familyGroupId, name, parentItemId = null, replaceTempId }) => {
      if (!isShoppingListOfflineQueuedError(error)) {
        return;
      }

      if (replaceTempId !== undefined) {
        persistOptimisticList(queryClient, familyGroupId);
        return;
      }

      const tempId = error.tempId ?? generateTempShoppingListItemId();
      const now = new Date().toISOString();

      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) => {
        if (!shoppingList) {
          return shoppingList;
        }

        const localItem: ShoppingListItem = {
          id: tempId,
          shopping_list_id: shoppingList.id,
          name,
          checked: false,
          deleted: false,
          created_by: 0,
          parent_item_id: typeof parentItemId === 'number' ? parentItemId : null,
          position: shoppingList.items.length,
          created_at: now,
          updated_at: now,
        };

        return {
          ...shoppingList,
          items: [...shoppingList.items, localItem],
        };
      });
    },
  });
}

export function useBulkAddShoppingListItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      familyGroupId,
      items,
    }: {
      familyGroupId: number;
      items: BulkShoppingListItemPayload[];
    }) => {
      try {
        return await bulkAddShoppingListItems(familyGroupId, items);
      } catch (error) {
        if (!isNetworkError(error)) {
          throw error;
        }

        await enqueueAndScheduleFlush(queryClient, {
          opId: createPendingOpId(),
          type: 'bulkAdd',
          familyGroupId,
          items,
        });
        throw new ShoppingListOfflineQueuedError();
      }
    },
    onSuccess: (createdItems, { familyGroupId }) => {
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) => [...items, ...createdItems])
      );
    },
  });
}

export function useUpdateShoppingListItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      familyGroupId,
      itemId,
      updates,
    }: {
      familyGroupId: number;
      itemId: number | string;
      updates: { name?: string; checked?: boolean };
    }) => {
      if (typeof itemId === 'number') {
        try {
          return await updateShoppingListItem(familyGroupId, itemId, updates);
        } catch (error) {
          if (!isNetworkError(error)) {
            throw error;
          }
        }
      }

      await enqueueAndScheduleFlush(queryClient, {
        opId: createPendingOpId(),
        type: 'update',
        familyGroupId,
        itemId,
        updates,
      });
      throw new ShoppingListOfflineQueuedError();
    },
    onSuccess: (updatedItem, { familyGroupId }) => {
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          items.map((item) => (item.id === updatedItem.id ? updatedItem : item))
        )
      );
    },
    onError: (error, { familyGroupId }) => {
      if (isShoppingListOfflineQueuedError(error)) {
        persistOptimisticList(queryClient, familyGroupId);
      }
    },
  });
}

export function useDeleteShoppingListItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      familyGroupId,
      itemId,
    }: {
      familyGroupId: number;
      itemId: number | string;
    }) => {
      if (typeof itemId === 'number') {
        try {
          await deleteShoppingListItem(familyGroupId, itemId);
          return;
        } catch (error) {
          if (!isNetworkError(error)) {
            throw error;
          }
        }
      }

      await enqueueAndScheduleFlush(queryClient, {
        opId: createPendingOpId(),
        type: 'delete',
        familyGroupId,
        itemId,
      });
      throw new ShoppingListOfflineQueuedError();
    },
    onSuccess: (_, { familyGroupId, itemId }) => {
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          items.filter((item) => item.id !== itemId)
        )
      );
    },
    onError: (error, { familyGroupId, itemId }) => {
      if (!isShoppingListOfflineQueuedError(error)) {
        return;
      }

      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          items.filter((item) => item.id !== itemId)
        )
      );
    },
  });
}

export function useBulkUpdateShoppingListItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      familyGroupId,
      items,
    }: {
      familyGroupId: number;
      items: BulkShoppingListItemUpdateInput[];
    }) => {
      const numericItems = toNumericBulkUpdates(items);
      if (numericItems) {
        try {
          return await bulkUpdateShoppingListItems(familyGroupId, numericItems);
        } catch (error) {
          if (!isNetworkError(error)) {
            throw error;
          }
        }
      }

      await enqueueAndScheduleFlush(queryClient, {
        opId: createPendingOpId(),
        type: 'bulkUpdate',
        familyGroupId,
        items,
      });
      throw new ShoppingListOfflineQueuedError();
    },
    onMutate: async ({ familyGroupId, items }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ShoppingList>(queryKey);
      const localUpdates = items.map((item) => ({ ...item }));

      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (listItems) =>
          applyLocalItemUpdates(listItems, localUpdates)
        )
      );

      return { previous };
    },
    onError: (error, { familyGroupId }, context) => {
      if (!shouldRollbackShoppingListOptimistic(error)) {
        persistOptimisticList(queryClient, familyGroupId);
        return;
      }

      if (context?.previous) {
        queryClient.setQueryData(shoppingListKeys.family(familyGroupId), context.previous);
      }
    },
    onSuccess: (serverItems, { familyGroupId }) => {
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          mergeServerItems(items, serverItems)
        )
      );
    },
  });
}

export function useBulkDeleteShoppingListItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      familyGroupId,
      ids,
    }: {
      familyGroupId: number;
      ids: Array<number | string>;
    }) => {
      const numericIds = toNumericIds(ids);
      if (numericIds) {
        try {
          await bulkDeleteShoppingListItems(familyGroupId, numericIds);
          return;
        } catch (error) {
          if (!isNetworkError(error)) {
            throw error;
          }
        }
      }

      await enqueueAndScheduleFlush(queryClient, {
        opId: createPendingOpId(),
        type: 'bulkDelete',
        familyGroupId,
        ids,
      });
      throw new ShoppingListOfflineQueuedError();
    },
    onMutate: async ({ familyGroupId, ids }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ShoppingList>(queryKey);
      const idSet = new Set(ids);

      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          items.filter((item) => !idSet.has(item.id))
        )
      );

      return { previous };
    },
    onError: (error, { familyGroupId }, context) => {
      if (!shouldRollbackShoppingListOptimistic(error)) {
        persistOptimisticList(queryClient, familyGroupId);
        return;
      }

      if (context?.previous) {
        queryClient.setQueryData(shoppingListKeys.family(familyGroupId), context.previous);
      }
    },
    onSuccess: (_, { familyGroupId }) => {
      persistOptimisticList(queryClient, familyGroupId);
    },
  });
}

export function useReorderShoppingListItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      familyGroupId,
      items,
    }: {
      familyGroupId: number;
      items: ShoppingListReorderItemInput[];
      nextItems: ShoppingListItem[];
    }) => {
      const numericItems = toNumericReorderItems(items);
      if (numericItems) {
        try {
          return await reorderShoppingListItems(familyGroupId, numericItems);
        } catch (error) {
          if (!isNetworkError(error)) {
            throw error;
          }
        }
      }

      await enqueueAndScheduleFlush(queryClient, {
        opId: createPendingOpId(),
        type: 'reorder',
        familyGroupId,
        items,
      });
      throw new ShoppingListOfflineQueuedError();
    },
    onMutate: async ({ familyGroupId, nextItems }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);
      await queryClient.cancelQueries({ queryKey });

      const previous = queryClient.getQueryData<ShoppingList>(queryKey);

      if (nextItems) {
        setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
          shoppingList ? { ...shoppingList, items: nextItems } : shoppingList
        );
      }

      return { previous };
    },
    onError: (error, { familyGroupId }, context) => {
      if (!shouldRollbackShoppingListOptimistic(error)) {
        persistOptimisticList(queryClient, familyGroupId);
        return;
      }

      if (context?.previous) {
        queryClient.setQueryData(shoppingListKeys.family(familyGroupId), context.previous);
      }
    },
    onSuccess: (serverItems, { familyGroupId }) => {
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          mergeServerItems(items, serverItems)
        )
      );
    },
  });
}
