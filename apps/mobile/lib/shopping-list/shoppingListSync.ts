import type { QueryClient } from '@tanstack/react-query';

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
import {
  loadQueue,
  remapTempIdsInOps,
  replaceQueue,
} from '@/lib/shopping-list/shoppingListPendingQueue';
import { saveShoppingListCache } from '@/lib/shopping-list/shoppingListStorage';
import type {
  ShoppingList,
  ShoppingListItem,
  ShoppingListPendingOp,
} from '@/types/shoppingList';

export type ShoppingListSyncStatus = {
  isFlushing: boolean;
  isOnline: boolean;
  syncError: string | null;
  pendingCount: number;
};

type SyncStatusListener = () => void;

const flushLocks = new Set<number>();
const statusByFamily = new Map<number, ShoppingListSyncStatus>();
const statusListeners = new Set<SyncStatusListener>();
let statusVersion = 0;

function getDefaultStatus(pendingCount = 0): ShoppingListSyncStatus {
  return {
    isFlushing: false,
    isOnline: true,
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

function isGoneError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 410);
}

function toNumericBulkUpdates(
  items: Array<{ id: number | string; name?: string; checked?: boolean }>
): BulkShoppingListItemUpdate[] | null {
  if (items.some((item) => typeof item.id !== 'number')) {
    return null;
  }
  return items as BulkShoppingListItemUpdate[];
}

function toNumericReorderItems(
  items: Array<{
    id: number | string;
    parent_item_id: number | string | null;
    position: number;
  }>
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
      if (typeof op.parentItemId === 'string') {
        throw new Error('Parent item still has a temporary id');
      }

      const created = await addShoppingListItem(op.familyGroupId, {
        name: op.name,
        parent_item_id: op.parentItemId,
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
  familyGroupId: number
): Promise<void> {
  const shoppingList = await fetchShoppingList(familyGroupId);
  queryClient.setQueryData<ShoppingList>(shoppingListKeys.family(familyGroupId), shoppingList);
  await saveShoppingListCache(familyGroupId, shoppingList);
}

export async function flushShoppingListPendingOps(
  queryClient: QueryClient,
  familyGroupId: number
): Promise<void> {
  if (flushLocks.has(familyGroupId)) {
    return;
  }

  flushLocks.add(familyGroupId);
  patchSyncStatus(familyGroupId, { isFlushing: true, syncError: null });

  try {
    let queue = await loadQueue(familyGroupId);
    patchSyncStatus(familyGroupId, { pendingCount: queue.length });

    if (queue.length === 0) {
      return;
    }

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
          return;
        }

        if (isGoneError(error)) {
          queue = rest;
          await replaceQueue(familyGroupId, queue);
          patchSyncStatus(familyGroupId, { pendingCount: queue.length });
          continue;
        }

        const message =
          error instanceof Error ? error.message : 'Failed to sync shopping list';
        patchSyncStatus(familyGroupId, { syncError: message });
        return;
      }
    }

    if (didFlushAny) {
      try {
        await refreshShoppingListFromServer(queryClient, familyGroupId);
      } catch (error) {
        if (isNetworkError(error)) {
          patchSyncStatus(familyGroupId, { isOnline: false });
          return;
        }
        const message =
          error instanceof Error ? error.message : 'Failed to refresh shopping list';
        patchSyncStatus(familyGroupId, { syncError: message });
      }
    }
  } finally {
    flushLocks.delete(familyGroupId);
    const pendingCount = (await loadQueue(familyGroupId)).length;
    patchSyncStatus(familyGroupId, { isFlushing: false, pendingCount });
  }
}
