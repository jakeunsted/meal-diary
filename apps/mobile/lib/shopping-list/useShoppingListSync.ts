import { useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import {
  getPendingOpsCount,
  getShoppingListPendingSnapshotVersion,
  loadQueue,
  subscribeShoppingListPending,
} from '@/lib/shopping-list/shoppingListPendingQueue';
import {
  flushShoppingListPendingOps,
  getShoppingListSyncStatus,
  getShoppingListSyncStatusVersion,
  setShoppingListOnlineStatus,
  subscribeShoppingListSyncStatus,
  type ShoppingListSyncStatus,
} from '@/lib/shopping-list/shoppingListSync';

function isNetworkOnline(state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}): boolean {
  if (state.isConnected === false) {
    return false;
  }
  if (state.isInternetReachable === false) {
    return false;
  }
  return true;
}

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
        syncError: null,
        pendingCount: 0,
      };
    }

    const syncStatus = getShoppingListSyncStatus(familyGroupId);
    return {
      ...syncStatus,
      pendingCount: getPendingOpsCount(familyGroupId),
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
      if (cancelled) {
        return;
      }

      try {
        const networkState = await Network.getNetworkStateAsync();
        const online = isNetworkOnline(networkState);
        setShoppingListOnlineStatus(familyGroupId, online);
        if (online) {
          triggerFlush();
        }
      } catch {
        triggerFlush();
      }
    })();

    const networkSubscription = Network.addNetworkStateListener((state) => {
      const online = isNetworkOnline(state);
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
