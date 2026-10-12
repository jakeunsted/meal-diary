import { useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { isNetworkStateOnline } from '@/lib/shopping-list/shoppingListNetwork';
import {
  getPendingOpsCount,
  getShoppingListPendingSnapshotVersion,
  loadQueue,
  subscribeShoppingListPending,
} from '@/lib/shopping-list/shoppingListPendingQueue';
import { loadShoppingListCache } from '@/lib/shopping-list/shoppingListStorage';
import {
  flushShoppingListPendingOps,
  getShoppingListSyncStatus,
  getShoppingListSyncStatusVersion,
  setShoppingListDirtyStatus,
  setShoppingListOnlineStatus,
  subscribeShoppingListSyncStatus,
  type ShoppingListSyncStatus,
} from '@/lib/shopping-list/shoppingListSync';

export function useShoppingListSync(familyGroupId: number | undefined): ShoppingListSyncStatus {
  const queryClient = useQueryClient();

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

  const status = useMemo(() => {
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
    // pendingVersion/syncVersion intentionally invalidate this snapshot
  }, [familyGroupId, pendingVersion, syncVersion]);

  useEffect(() => {
    if (!familyGroupId) {
      return;
    }

    let cancelled = false;

    const triggerFlush = () => {
      if (cancelled) {
        return;
      }
      void flushShoppingListPendingOps(queryClient, familyGroupId);
    };

    void (async () => {
      await loadQueue(familyGroupId);
      const cached = await loadShoppingListCache(familyGroupId);
      if (cancelled) {
        return;
      }
      setShoppingListDirtyStatus(familyGroupId, !!cached?.dirty);

      try {
        const networkState = await Network.getNetworkStateAsync();
        const online = isNetworkStateOnline(networkState);
        setShoppingListOnlineStatus(familyGroupId, online);
        if (online) {
          triggerFlush();
        }
      } catch {
        triggerFlush();
      }
    })();

    const networkSubscription = Network.addNetworkStateListener((state) => {
      const online = isNetworkStateOnline(state);
      setShoppingListOnlineStatus(familyGroupId, online);
      if (online) {
        triggerFlush();
      }
    });

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        triggerFlush();
      }
    };
    const appSubscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      cancelled = true;
      networkSubscription.remove();
      appSubscription.remove();
    };
  }, [familyGroupId, queryClient]);

  return status;
}
