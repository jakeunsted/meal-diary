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
        syncError: null,
        pendingCount: 0,
      };
    }

    return {
      ...getShoppingListSyncStatus(familyGroupId),
      pendingCount: getPendingOpsCount(familyGroupId),
    };
  }, [familyGroupId, pendingVersion, syncVersion]);
}
