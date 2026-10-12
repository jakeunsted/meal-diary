import { useMemo, useSyncExternalStore } from 'react';

import {
  getPendingOpsCount,
  getShoppingListPendingSnapshotVersion,
  subscribeShoppingListPending,
} from '@/lib/shopping-list/shoppingListPendingQueue';
import {
  getShoppingListSyncStatus,
  getShoppingListSyncStatusVersion,
  subscribeShoppingListSyncStatus,
  type ShoppingListSyncStatus,
} from '@/lib/shopping-list/shoppingListSync';

/** Read-only sync status for UI (listeners live in useShoppingListSync). */
export function useShoppingListSyncStatus(
  familyGroupId: number | undefined
): ShoppingListSyncStatus {
  const pendingVersion = useSyncExternalStore(
    subscribeShoppingListPending,
    getShoppingListPendingSnapshotVersion,
    getShoppingListPendingSnapshotVersion
  );

  const syncVersion = useSyncExternalStore(
    subscribeShoppingListSyncStatus,
    getShoppingListSyncStatusVersion,
    getShoppingListSyncStatusVersion
  );

  return useMemo(() => {
    if (!familyGroupId) {
      return {
        isFlushing: false,
        isOnline: true,
        isDirty: false,
        syncError: null,
        pendingCount: 0,
      };
    }

    const syncStatus = getShoppingListSyncStatus(familyGroupId);
    return {
      ...syncStatus,
      pendingCount: getPendingOpsCount(familyGroupId) + (syncStatus.isDirty ? 1 : 0),
    };
  }, [familyGroupId, pendingVersion, syncVersion]);
}
