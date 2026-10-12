import type { QueryClient } from '@tanstack/react-query';

import { isShoppingCategory, type ShoppingCategory } from '@meal-diary/shared';

import { ApiError } from '@/lib/api/errors';
import { isNetworkError } from '@/lib/auth/httpError';
import {
  addShoppingListItem,
  bulkAddShoppingListItems,
  bulkDeleteShoppingListItems,
  bulkUpdateShoppingListItems,
  deleteShoppingListItem,
  fetchShoppingList,
  reorderShoppingListItems,
  setShoppingListQueryData,
  shoppingListKeys,
  updateShoppingListItem,
  type BulkShoppingListItemUpdate,
  type ShoppingListReorderItem,
} from '@/lib/queries/shoppingList';
import { isShoppingListDeviceOnline } from '@/lib/shopping-list/shoppingListNetwork';
import {
  loadQueue,
  remapTempIdsInOps,
  replaceQueue,
  sanitizePendingOpsForCategories,
} from '@/lib/shopping-list/shoppingListPendingQueue';
import {
  isShoppingListReconcilePlanEmpty,
  planShoppingListReconcile,
} from '@/lib/shopping-list/shoppingListReconcile';
import {
  getShoppingListDirtyEpoch,
  loadShoppingListCache,
  saveShoppingListBaseline,
  saveShoppingListCache,
  saveShoppingListServerCopy,
  startShoppingListReconcileHold,
} from '@/lib/shopping-list/shoppingListStorage';
import { resolveShoppingListItemCategory } from '@/lib/shopping-list/shoppingListTree';
import type {
  ShoppingList,
  ShoppingListItem,
  ShoppingListPendingOp,
} from '@/types/shoppingList';

export type ShoppingListSyncStatus = {
  isFlushing: boolean;
  isOnline: boolean;
  isDirty: boolean;
  syncError: string | null;
  pendingCount: number;
};

type SyncStatusListener = () => void;

const flushLocks = new Set<number>();
const flushAgain = new Set<number>();
const statusByFamily = new Map<number, ShoppingListSyncStatus>();
const statusListeners = new Set<SyncStatusListener>();
let statusVersion = 0;

export { sanitizePendingOpsForCategories };

function getDefaultStatus(pendingCount = 0): ShoppingListSyncStatus {
  return {
    isFlushing: false,
    isOnline: true,
    isDirty: false,
    syncError: null,
    pendingCount,
  };
}

function notifyStatusListeners(): void {
  statusVersion += 1;
  for (const listener of statusListeners) {
    listener();
  }
}

export function subscribeShoppingListSyncStatus(listener: SyncStatusListener): () => void {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function getShoppingListSyncStatusVersion(): number {
  return statusVersion;
}

export function getShoppingListSyncStatus(familyGroupId: number): ShoppingListSyncStatus {
  return statusByFamily.get(familyGroupId) ?? getDefaultStatus();
}

function patchSyncStatus(
  familyGroupId: number,
  patch: Partial<ShoppingListSyncStatus>
): void {
  const current = getShoppingListSyncStatus(familyGroupId);
  statusByFamily.set(familyGroupId, { ...current, ...patch });
  notifyStatusListeners();
}

export function setShoppingListOnlineStatus(
  familyGroupId: number,
  isOnline: boolean
): void {
  patchSyncStatus(familyGroupId, { isOnline });
}

export function setShoppingListDirtyStatus(familyGroupId: number, isDirty: boolean): void {
  patchSyncStatus(familyGroupId, { isDirty });
}

function isGoneError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 410);
}

function toNumericBulkUpdates(
  items: Array<{
    id: number | string;
    name?: string;
    checked?: boolean;
    category?: ShoppingCategory | string;
  }>
): BulkShoppingListItemUpdate[] | null {
  if (items.some((item) => typeof item.id !== 'number')) {
    return null;
  }
  return items as BulkShoppingListItemUpdate[];
}

function toNumericReorderItems(
  items: Array<{
    id: number | string;
    category: ShoppingCategory | string;
    position: number;
  }>
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

function replaceTempIdInQueryCache(
  queryClient: QueryClient,
  familyGroupId: number,
  tempId: string,
  serverItem: ShoppingListItem,
  serverId: number
): void {
  setShoppingListQueryData(queryClient, familyGroupId, (shoppingList) => {
    if (!shoppingList) {
      return shoppingList;
    }

    return {
      ...shoppingList,
      items: shoppingList.items.map((item) =>
        item.id === tempId ? { ...serverItem, id: serverId } : item
      ),
    };
  });
}

async function executePendingOp(
  queryClient: QueryClient,
  op: ShoppingListPendingOp
): Promise<{ remappedTempId?: string; serverId?: number }> {
  switch (op.type) {
    case 'add': {
      const category = resolveShoppingListItemCategory(op.category);
      const created = await addShoppingListItem(op.familyGroupId, {
        name: op.name,
        category,
      });
      if (typeof created.id !== 'number') {
        throw new Error('Server returned a non-numeric shopping list item id');
      }
      replaceTempIdInQueryCache(
        queryClient,
        op.familyGroupId,
        op.tempId,
        created,
        created.id
      );
      return { remappedTempId: op.tempId, serverId: created.id };
    }
    case 'update': {
      if (typeof op.itemId !== 'number') {
        throw new Error('Item still has a temporary id');
      }
      await updateShoppingListItem(op.familyGroupId, op.itemId, op.updates);
      return {};
    }
    case 'delete': {
      if (typeof op.itemId !== 'number') {
        throw new Error('Item still has a temporary id');
      }
      await deleteShoppingListItem(op.familyGroupId, op.itemId);
      return {};
    }
    case 'bulkUpdate': {
      const numericItems = toNumericBulkUpdates(op.items);
      if (!numericItems) {
        throw new Error('Bulk update still references temporary ids');
      }
      await bulkUpdateShoppingListItems(op.familyGroupId, numericItems);
      return {};
    }
    case 'bulkDelete': {
      if (op.ids.some((id) => typeof id !== 'number')) {
        throw new Error('Bulk delete still references temporary ids');
      }
      await bulkDeleteShoppingListItems(op.familyGroupId, op.ids as number[]);
      return {};
    }
    case 'reorder': {
      const numericItems = toNumericReorderItems(op.items);
      if (!numericItems) {
        throw new Error('Reorder still references temporary ids');
      }
      await reorderShoppingListItems(op.familyGroupId, numericItems);
      return {};
    }
    case 'bulkAdd': {
      await bulkAddShoppingListItems(op.familyGroupId, op.items);
      return {};
    }
    default:
      return {};
  }
}

async function refreshShoppingListFromServer(
  queryClient: QueryClient,
  familyGroupId: number,
  epoch: number
): Promise<boolean> {
  const shoppingList = await fetchShoppingList(familyGroupId);
  const cached = await loadShoppingListCache(familyGroupId);
  if (cached?.dirty || getShoppingListDirtyEpoch(familyGroupId) !== epoch) {
    await saveShoppingListBaseline(familyGroupId, shoppingList);
    return false;
  }
  const saved = await saveShoppingListServerCopy(familyGroupId, shoppingList, epoch);
  if (!saved) {
    return false;
  }
  queryClient.setQueryData<ShoppingList>(shoppingListKeys.family(familyGroupId), shoppingList);
  setShoppingListDirtyStatus(familyGroupId, false);
  return true;
}

function replaceTempItems(
  list: ShoppingList,
  adds: { tempId: string }[],
  created: ShoppingListItem[]
): ShoppingList {
  const createdByTempId = new Map<string, ShoppingListItem>();
  adds.forEach((add, index) => {
    const serverItem = created[index];
    if (serverItem && typeof serverItem.id === 'number') {
      createdByTempId.set(add.tempId, serverItem);
    }
  });

  return {
    ...list,
    items: list.items.flatMap((item) => {
      if (typeof item.id !== 'string') {
        return [item];
      }
      const serverItem = createdByTempId.get(item.id);
      if (!serverItem) {
        return item.name.trim() ? [item] : [];
      }
      return [
        {
          ...serverItem,
          name: item.name,
          checked: item.checked,
          category: item.category,
          position: item.position,
        },
      ];
    }),
  };
}

async function reconcileShoppingListSnapshot(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<boolean> {
  const release = startShoppingListReconcileHold();
  const epoch = getShoppingListDirtyEpoch(familyGroupId);

  try {
    await queryClient.cancelQueries({ queryKey: shoppingListKeys.family(familyGroupId) });
    const cached = await loadShoppingListCache(familyGroupId);
    if (!cached?.dirty) {
      return true;
    }

    const baseline = cached.baseline ?? cached.shoppingList;
    let local = cached.shoppingList;
    let plan = planShoppingListReconcile(local, baseline);

    try {
      if (!isShoppingListReconcilePlanEmpty(plan)) {
        if (plan.adds.length > 0) {
          const created = await bulkAddShoppingListItems(
            familyGroupId,
            plan.adds.map((item) => ({ name: item.name, category: item.category }))
          );
          local = replaceTempItems(local, plan.adds, created);
          await saveShoppingListCache(familyGroupId, local);
          queryClient.setQueryData<ShoppingList>(shoppingListKeys.family(familyGroupId), local);
          plan = planShoppingListReconcile(local, baseline);
        }

        if (plan.updates.length > 0) {
          await bulkUpdateShoppingListItems(familyGroupId, plan.updates);
        }
        if (plan.deletes.length > 0) {
          await bulkDeleteShoppingListItems(familyGroupId, plan.deletes);
        }
        if (plan.reorders.length > 0) {
          await reorderShoppingListItems(familyGroupId, plan.reorders);
        }
      }

      if (getShoppingListDirtyEpoch(familyGroupId) !== epoch) {
        return true;
      }

      return await refreshShoppingListFromServer(queryClient, familyGroupId, epoch);
    } catch (error) {
      if (isNetworkError(error)) {
        patchSyncStatus(familyGroupId, { isOnline: false });
        return false;
      }
      const message = error instanceof Error ? error.message : 'Failed to sync shopping list';
      patchSyncStatus(familyGroupId, { syncError: message });
      return false;
    }
  } finally {
    release();
  }
}

export async function flushShoppingListPendingOps(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<void> {
  if (flushLocks.has(familyGroupId)) {
    flushAgain.add(familyGroupId);
    return;
  }

  flushLocks.add(familyGroupId);
  patchSyncStatus(familyGroupId, { isFlushing: true, syncError: null });

  try {
    do {
      flushAgain.delete(familyGroupId);
      const stopped = await flushShoppingListOnce(queryClient, familyGroupId);
      if (stopped) {
        break;
      }
    } while (flushAgain.has(familyGroupId));
  } finally {
    flushLocks.delete(familyGroupId);
    const cached = await loadShoppingListCache(familyGroupId);
    const pendingCount = (await loadQueue(familyGroupId)).length;
    patchSyncStatus(familyGroupId, {
      isFlushing: false,
      pendingCount,
      isDirty: !!cached?.dirty,
    });
    if (flushAgain.has(familyGroupId)) {
      flushAgain.delete(familyGroupId);
      void flushShoppingListPendingOps(queryClient, familyGroupId);
    }
  }
}

/** @returns true when sync should stop (offline or a server error). */
async function flushShoppingListOnce(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<boolean> {
  const online = await isShoppingListDeviceOnline();
  if (!online) {
    patchSyncStatus(familyGroupId, { isOnline: false });
    return true;
  }

  const loaded = await loadQueue(familyGroupId);
  let queue = sanitizePendingOpsForCategories(loaded);
  if (JSON.stringify(queue) !== JSON.stringify(loaded)) {
    await replaceQueue(familyGroupId, queue);
  }
  patchSyncStatus(familyGroupId, { pendingCount: queue.length });

  let didFlushAny = false;

  while (queue.length > 0) {
    const [head, ...rest] = queue;

    try {
      const result = await executePendingOp(queryClient, head);
      didFlushAny = true;

      let nextRest = rest;
      if (result.remappedTempId != null && result.serverId != null) {
        nextRest = remapTempIdsInOps(rest, result.remappedTempId, result.serverId);
      }

      queue = nextRest;
      await replaceQueue(familyGroupId, queue);
      patchSyncStatus(familyGroupId, { pendingCount: queue.length, syncError: null });
    } catch (error) {
      if (isNetworkError(error)) {
        patchSyncStatus(familyGroupId, { isOnline: false });
        return true;
      }

      if (isGoneError(error)) {
        queue = rest;
        await replaceQueue(familyGroupId, queue);
        patchSyncStatus(familyGroupId, { pendingCount: queue.length });
        continue;
      }

      const message = error instanceof Error ? error.message : 'Failed to sync shopping list';
      patchSyncStatus(familyGroupId, { syncError: message });
      return true;
    }
  }

  const epoch = getShoppingListDirtyEpoch(familyGroupId);
  if (didFlushAny) {
    const cached = await loadShoppingListCache(familyGroupId);
    if (!cached?.dirty) {
      try {
        const refreshed = await refreshShoppingListFromServer(queryClient, familyGroupId, epoch);
        if (!refreshed && (await loadShoppingListCache(familyGroupId))?.dirty) {
          const reconciled = await reconcileShoppingListSnapshot(queryClient, familyGroupId);
          return !reconciled;
        }
      } catch (error) {
        if (isNetworkError(error)) {
          patchSyncStatus(familyGroupId, { isOnline: false });
          return true;
        }
        const message =
          error instanceof Error ? error.message : 'Failed to refresh shopping list';
        patchSyncStatus(familyGroupId, { syncError: message });
        return true;
      }
      return false;
    }
  }

  const cached = await loadShoppingListCache(familyGroupId);
  if (!cached?.dirty) {
    return false;
  }

  const reconciled = await reconcileShoppingListSnapshot(queryClient, familyGroupId);
  return !reconciled;
}
