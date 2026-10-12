import {
  categorizeShoppingItemName,
  isShoppingCategory,
  type ShoppingCategory,
} from '@meal-diary/shared';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { apiFetch, ApiError } from '@/lib/api/client';
import { isNetworkError } from '@/lib/auth/httpError';
import { commitShoppingListWrite } from '@/lib/shopping-list/shoppingListCommit';
import { isShoppingListDeviceOnline } from '@/lib/shopping-list/shoppingListNetwork';
import {
  ShoppingListOfflineQueuedError,
  isShoppingListOfflineQueuedError,
  shouldRollbackShoppingListOptimistic,
} from '@/lib/shopping-list/shoppingListOfflineError';
import {
  generateTempShoppingListItemId,
  resolveShoppingListItemCategory,
} from '@/lib/shopping-list/shoppingListTree';
import {
  adoptShoppingListIfClean,
  loadShoppingListCache,
  markShoppingListDirty,
  saveShoppingListCache,
  saveShoppingListServerCopy,
  waitForShoppingListReconcile,
} from '@/lib/shopping-list/shoppingListStorage';
import type { ShoppingList, ShoppingListItem } from '@/types/shoppingList';

const SHOPPING_LIST_STALE_MS = 5 * 60 * 1000;
const SHOPPING_LIST_TIMEOUT_MS = 8_000;

export const shoppingListKeys = {
  all: ['shoppingList'] as const,
  family: (familyGroupId: number) => ['shoppingList', familyGroupId] as const,
};

export async function fetchShoppingList(
  familyGroupId: number,
  signal?: AbortSignal
): Promise<ShoppingList> {
  return apiFetch<ShoppingList>(`/shopping-list/${familyGroupId}`, {
    timeoutMs: SHOPPING_LIST_TIMEOUT_MS,
    signal,
  });
}

export async function addShoppingListItem(
  familyGroupId: number,
  payload: { name: string; category?: ShoppingCategory }
): Promise<ShoppingListItem> {
  return apiFetch<ShoppingListItem>(`/shopping-list/${familyGroupId}/items`, {
    method: 'POST',
    body: payload,
    timeoutMs: SHOPPING_LIST_TIMEOUT_MS,
  });
}

export interface BulkShoppingListItemPayload {
  name: string;
  category?: ShoppingCategory;
}

export async function bulkAddShoppingListItems(
  familyGroupId: number,
  items: BulkShoppingListItemPayload[]
): Promise<ShoppingListItem[]> {
  return apiFetch<ShoppingListItem[]>(`/shopping-list/${familyGroupId}/items/bulk`, {
    method: 'POST',
    body: { items },
    timeoutMs: SHOPPING_LIST_TIMEOUT_MS,
  });
}

export async function deleteShoppingListItem(
  familyGroupId: number,
  itemId: number
): Promise<void> {
  await apiFetch<void>(`/shopping-list/${familyGroupId}/items/${itemId}`, {
    method: 'DELETE',
    timeoutMs: SHOPPING_LIST_TIMEOUT_MS,
  });
}

export async function updateShoppingListItem(
  familyGroupId: number,
  itemId: number,
  updates: { name?: string; checked?: boolean; category?: ShoppingCategory }
): Promise<ShoppingListItem> {
  return apiFetch<ShoppingListItem>(`/shopping-list/${familyGroupId}/items/${itemId}`, {
    method: 'PUT',
    body: updates,
    timeoutMs: SHOPPING_LIST_TIMEOUT_MS,
  });
}

export interface BulkShoppingListItemUpdate {
  id: number;
  name?: string;
  checked?: boolean;
  category?: ShoppingCategory;
}

export interface BulkShoppingListItemUpdateInput {
  id: number | string;
  name?: string;
  checked?: boolean;
  category?: ShoppingCategory;
}

export async function bulkUpdateShoppingListItems(
  familyGroupId: number,
  items: BulkShoppingListItemUpdate[]
): Promise<ShoppingListItem[]> {
  return apiFetch<ShoppingListItem[]>(`/shopping-list/${familyGroupId}/items/bulk-update`, {
    method: 'PUT',
    body: { items },
    timeoutMs: SHOPPING_LIST_TIMEOUT_MS,
  });
}

export async function bulkDeleteShoppingListItems(
  familyGroupId: number,
  ids: number[]
): Promise<void> {
  await apiFetch<void>(`/shopping-list/${familyGroupId}/items/bulk-delete`, {
    method: 'POST',
    body: { ids },
    timeoutMs: SHOPPING_LIST_TIMEOUT_MS,
  });
}

export interface ShoppingListReorderItem {
  id: number;
  category: ShoppingCategory;
  position: number;
}

export interface ShoppingListReorderItemInput {
  id: number | string;
  category: ShoppingCategory;
  position: number;
}

export async function reorderShoppingListItems(
  familyGroupId: number,
  items: ShoppingListReorderItem[]
): Promise<ShoppingListItem[]> {
  return apiFetch<ShoppingListItem[]>(`/shopping-list/${familyGroupId}/items/reorder`, {
    method: 'PUT',
    body: { items },
    timeoutMs: SHOPPING_LIST_TIMEOUT_MS,
  });
}

function applyLocalItemUpdates(
  items: ShoppingListItem[],
  updates: {
    id: number | string;
    name?: string;
    checked?: boolean;
    category?: ShoppingCategory;
  }[]
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
      ...(update.category !== undefined
        ? { category: resolveShoppingListItemCategory(update.category) }
        : {}),
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

function restoreShoppingListSnapshot(
  queryClient: QueryClient,
  familyGroupId: number,
  previous: ShoppingList | undefined
): void {
  if (!previous) {
    return;
  }
  queryClient.setQueryData(shoppingListKeys.family(familyGroupId), previous);
  void saveShoppingListCache(familyGroupId, previous);
}

function localShoppingListItem(
  shoppingList: ShoppingList,
  tempId: string,
  name: string,
  category: ShoppingCategory
): ShoppingListItem {
  const categoryItems = shoppingList.items.filter(
    (item) => resolveShoppingListItemCategory(item.category) === category
  );
  const nextPosition =
    categoryItems.length === 0 ? 0 : Math.max(...categoryItems.map((item) => item.position)) + 1;
  const now = new Date().toISOString();

  return {
    id: tempId,
    shopping_list_id: shoppingList.id,
    name,
    checked: false,
    deleted: false,
    created_by: 0,
    category,
    position: nextPosition,
    created_at: now,
    updated_at: now,
  };
}

async function rememberCleanServerCopy(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<void> {
  const shoppingList = queryClient.getQueryData<ShoppingList>(
    shoppingListKeys.family(familyGroupId)
  );
  if (!shoppingList) {
    return;
  }
  await adoptShoppingListIfClean(familyGroupId, shoppingList);
  const cached = await loadShoppingListCache(familyGroupId);
  if (cached?.dirty) {
    return;
  }
  const { setShoppingListDirtyStatus } = await import('@/lib/shopping-list/shoppingListSync');
  setShoppingListDirtyStatus(familyGroupId, false);
}

async function keepLocalShoppingListChange(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<never> {
  await markShoppingListDirty(familyGroupId);
  const { setShoppingListDirtyStatus, flushShoppingListPendingOps } = await import(
    '@/lib/shopping-list/shoppingListSync'
  );
  setShoppingListDirtyStatus(familyGroupId, true);
  if (await isShoppingListDeviceOnline()) {
    void flushShoppingListPendingOps(queryClient, familyGroupId);
  }
  throw new ShoppingListOfflineQueuedError();
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
    ...(item.category !== undefined ? { category: item.category } : {}),
  }));
}

function toNumericReorderItems(
  items: ShoppingListReorderItemInput[]
): ShoppingListReorderItem[] | null {
  if (
    items.some((item) => typeof item.id !== 'number' || !isShoppingCategory(item.category))
  ) {
    return null;
  }

  return items.map((item) => ({
    id: item.id as number,
    category: item.category as ShoppingCategory,
    position: item.position,
  }));
}

function toNumericIds(ids: Array<number | string>): number[] | null {
  if (ids.some((id) => typeof id !== 'number')) {
    return null;
  }
  return ids as number[];
}

async function fetchShoppingListWithCache(
  familyGroupId: number,
  signal?: AbortSignal
): Promise<ShoppingList> {
  await waitForShoppingListReconcile();

  const cached = await loadShoppingListCache(familyGroupId);
  const online = await isShoppingListDeviceOnline();
  if (signal?.aborted || cached?.dirty || !online) {
    if (cached) {
      return cached.shoppingList;
    }
    throw new TypeError('Network request failed');
  }

  try {
    const shoppingList = await fetchShoppingList(familyGroupId, signal);
    const latest = await loadShoppingListCache(familyGroupId);
    if (signal?.aborted || latest?.dirty) {
      return latest?.shoppingList ?? shoppingList;
    }
    await saveShoppingListServerCopy(familyGroupId, shoppingList);
    const { setShoppingListDirtyStatus } = await import('@/lib/shopping-list/shoppingListSync');
    setShoppingListDirtyStatus(familyGroupId, false);
    return shoppingList;
  } catch (error) {
    const latest = await loadShoppingListCache(familyGroupId);
    if (latest) {
      return latest.shoppingList;
    }
    throw error;
  }
}

export function useShoppingListQuery(familyGroupId: number | undefined) {
  const queryClient = useQueryClient();
  const [hydratedFamilyId, setHydratedFamilyId] = useState<number | null>(null);

  useEffect(() => {
    if (!familyGroupId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const cached = await loadShoppingListCache(familyGroupId);
      if (cancelled) {
        return;
      }

      const queryKey = shoppingListKeys.family(familyGroupId);
      if (cached && !queryClient.getQueryData(queryKey)) {
        queryClient.setQueryData(queryKey, cached.shoppingList);
      }
      setHydratedFamilyId(familyGroupId);
    })();

    return () => {
      cancelled = true;
    };
  }, [familyGroupId, queryClient]);

  const hydrated = hydratedFamilyId === familyGroupId;

  return useQuery({
    queryKey: shoppingListKeys.family(familyGroupId ?? 0),
    queryFn: ({ signal }) => fetchShoppingListWithCache(familyGroupId!, signal),
    enabled: !!familyGroupId && hydrated,
    staleTime: SHOPPING_LIST_STALE_MS,
    refetchOnReconnect: false,
    retry: (failureCount, error) => !isNetworkError(error) && failureCount < 2,
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
      category,
    }: {
      familyGroupId: number;
      name: string;
      category?: ShoppingCategory;
      replaceTempId?: number | string;
    }) => {
      const resolvedCategory =
        category !== undefined
          ? resolveShoppingListItemCategory(category)
          : categorizeShoppingItemName(name);

      return commitShoppingListWrite(queryClient, familyGroupId, () =>
        addShoppingListItem(familyGroupId, {
          name,
          category: resolvedCategory,
        })
      );
    },
    onMutate: async ({ familyGroupId, name, category, replaceTempId }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ShoppingList>(queryKey);
      const resolvedCategory =
        category !== undefined
          ? resolveShoppingListItemCategory(category)
          : categorizeShoppingItemName(name);
      const tempId =
        typeof replaceTempId === 'string' ? replaceTempId : generateTempShoppingListItemId();

      if (replaceTempId === undefined) {
        setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) => {
          if (!shoppingList) {
            return shoppingList;
          }
          return {
            ...shoppingList,
            items: [
              ...shoppingList.items,
              localShoppingListItem(shoppingList, tempId, name, resolvedCategory),
            ],
          };
        });
      }

      return { previous, tempId };
    },
    onSuccess: (newItem, { familyGroupId, replaceTempId }, context) => {
      const localId = replaceTempId ?? context?.tempId;
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) => {
          if (localId === undefined) {
            return [...items, newItem];
          }
          const index = items.findIndex((item) => item.id === localId);
          if (index === -1) {
            return [...items, newItem];
          }
          const updated = [...items];
          updated[index] = newItem;
          return updated;
        })
      );
      void rememberCleanServerCopy(queryClient, familyGroupId);
    },
    onError: (error, { familyGroupId }, context) => {
      if (!shouldRollbackShoppingListOptimistic(error)) {
        persistOptimisticList(queryClient, familyGroupId);
        return;
      }
      restoreShoppingListSnapshot(queryClient, familyGroupId, context?.previous);
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
      return commitShoppingListWrite(queryClient, familyGroupId, () =>
        bulkAddShoppingListItems(familyGroupId, items)
      );
    },
    onMutate: async ({ familyGroupId, items }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ShoppingList>(queryKey);
      const tempIds = items.map(() => generateTempShoppingListItemId());

      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) => {
        if (!shoppingList) {
          return shoppingList;
        }

        let draft = shoppingList;
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          if (!item) {
            continue;
          }
          const localItem = localShoppingListItem(
            draft,
            tempIds[index] ?? generateTempShoppingListItemId(),
            item.name,
            item.category ?? categorizeShoppingItemName(item.name)
          );
          draft = { ...draft, items: [...draft.items, localItem] };
        }
        return draft;
      });

      return { previous, tempIds };
    },
    onSuccess: (createdItems, { familyGroupId }, context) => {
      const tempIds = new Set(context?.tempIds ?? []);
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) => [
          ...items.filter((item) => !tempIds.has(String(item.id))),
          ...createdItems,
        ])
      );
      void rememberCleanServerCopy(queryClient, familyGroupId);
    },
    onError: (error, { familyGroupId }, context) => {
      if (!shouldRollbackShoppingListOptimistic(error)) {
        persistOptimisticList(queryClient, familyGroupId);
        return;
      }
      restoreShoppingListSnapshot(queryClient, familyGroupId, context?.previous);
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
      updates: { name?: string; checked?: boolean; category?: ShoppingCategory };
    }) => {
      const resolvedUpdates = {
        ...updates,
        ...(updates.category !== undefined
          ? { category: resolveShoppingListItemCategory(updates.category) }
          : {}),
      };

      if (typeof itemId !== 'number') {
        return keepLocalShoppingListChange(queryClient, familyGroupId);
      }

      return commitShoppingListWrite(queryClient, familyGroupId, () =>
        updateShoppingListItem(familyGroupId, itemId, resolvedUpdates)
      );
    },
    onMutate: async ({ familyGroupId, itemId, updates }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ShoppingList>(queryKey);
      const resolvedUpdates = {
        ...updates,
        ...(updates.category !== undefined
          ? { category: resolveShoppingListItemCategory(updates.category) }
          : {}),
      };

      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          applyLocalItemUpdates(items, [{ id: itemId, ...resolvedUpdates }])
        )
      );

      return { previous };
    },
    onSuccess: (updatedItem, { familyGroupId }) => {
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          items.map((item) => (item.id === updatedItem.id ? updatedItem : item))
        )
      );
      void rememberCleanServerCopy(queryClient, familyGroupId);
    },
    onError: (error, { familyGroupId }, context) => {
      if (!shouldRollbackShoppingListOptimistic(error)) {
        persistOptimisticList(queryClient, familyGroupId);
        return;
      }
      restoreShoppingListSnapshot(queryClient, familyGroupId, context?.previous);
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
      if (typeof itemId !== 'number') {
        return keepLocalShoppingListChange(queryClient, familyGroupId);
      }

      return commitShoppingListWrite(queryClient, familyGroupId, async () => {
        await deleteShoppingListItem(familyGroupId, itemId);
      });
    },
    onMutate: async ({ familyGroupId, itemId }) => {
      const queryKey = shoppingListKeys.family(familyGroupId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ShoppingList>(queryKey);

      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          items.filter((item) => item.id !== itemId)
        )
      );

      return { previous };
    },
    onSuccess: (_, { familyGroupId }) => {
      void rememberCleanServerCopy(queryClient, familyGroupId);
    },
    onError: (error, { familyGroupId }, context) => {
      if (!shouldRollbackShoppingListOptimistic(error)) {
        persistOptimisticList(queryClient, familyGroupId);
        return;
      }
      restoreShoppingListSnapshot(queryClient, familyGroupId, context?.previous);
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
      if (!numericItems) {
        return keepLocalShoppingListChange(queryClient, familyGroupId);
      }

      return commitShoppingListWrite(queryClient, familyGroupId, () =>
        bulkUpdateShoppingListItems(familyGroupId, numericItems)
      );
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

      restoreShoppingListSnapshot(queryClient, familyGroupId, context?.previous);
    },
    onSuccess: (serverItems, { familyGroupId }) => {
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          mergeServerItems(items, serverItems)
        )
      );
      void rememberCleanServerCopy(queryClient, familyGroupId);
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
      if (!numericIds) {
        return keepLocalShoppingListChange(queryClient, familyGroupId);
      }

      return commitShoppingListWrite(queryClient, familyGroupId, async () => {
        await bulkDeleteShoppingListItems(familyGroupId, numericIds);
      });
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
        restoreShoppingListSnapshot(queryClient, familyGroupId, context.previous);
      }
    },
    onSuccess: (_, { familyGroupId }) => {
      void rememberCleanServerCopy(queryClient, familyGroupId);
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
      if (!numericItems) {
        return keepLocalShoppingListChange(queryClient, familyGroupId);
      }

      return commitShoppingListWrite(queryClient, familyGroupId, () =>
        reorderShoppingListItems(familyGroupId, numericItems)
      );
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

      restoreShoppingListSnapshot(queryClient, familyGroupId, context?.previous);
    },
    onSuccess: (serverItems, { familyGroupId }) => {
      setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) =>
        updateShoppingListItems(shoppingList, (items) =>
          mergeServerItems(items, serverItems)
        )
      );
      void rememberCleanServerCopy(queryClient, familyGroupId);
    },
  });
}
