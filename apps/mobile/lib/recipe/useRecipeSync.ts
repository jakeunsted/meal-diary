import { useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { isMealDiaryNetworkOnline } from '@/lib/diary/mealDiarySync';
import { loadRecipePendingQueue } from '@/lib/recipe/recipePendingQueue';
import {
  flushRecipePending,
  getRecipeConflicts,
  getRecipeSyncStatus,
  getRecipeSyncVersion,
  setRecipeDeviceOnline,
  subscribeRecipeSync,
  type RecipeSyncConflict,
  type RecipeSyncStatus,
} from '@/lib/recipe/recipeSync';

export function useRecipeSync(familyGroupId: number | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (Platform.OS !== 'android' || familyGroupId == null) {
      return;
    }

    let cancelled = false;
    const triggerFlush = () => {
      if (!cancelled) {
        void flushRecipePending(queryClient, familyGroupId);
      }
    };

    void (async () => {
      await loadRecipePendingQueue(familyGroupId);
      if (cancelled) {
        return;
      }
      try {
        const state = await Network.getNetworkStateAsync();
        const online = isMealDiaryNetworkOnline(state);
        setRecipeDeviceOnline(online);
        if (online) {
          triggerFlush();
        }
      } catch {
        triggerFlush();
      }
    })();

    const networkSubscription = Network.addNetworkStateListener((state) => {
      const online = isMealDiaryNetworkOnline(state);
      setRecipeDeviceOnline(online);
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
}

export function useRecipeSyncStatus(familyGroupId: number | undefined): RecipeSyncStatus {
  const syncVersion = useSyncExternalStore(
    subscribeRecipeSync,
    getRecipeSyncVersion,
    getRecipeSyncVersion
  );
  void syncVersion;
  if (!familyGroupId || Platform.OS !== 'android') {
    return { isFlushing: false, syncError: false, pendingCount: 0 };
  }
  return getRecipeSyncStatus(familyGroupId);
}

export function useRecipeConflicts(familyGroupId: number | undefined): RecipeSyncConflict[] {
  const syncVersion = useSyncExternalStore(
    subscribeRecipeSync,
    getRecipeSyncVersion,
    getRecipeSyncVersion
  );
  void syncVersion;
  if (!familyGroupId || Platform.OS !== 'android') {
    return [];
  }
  return getRecipeConflicts(familyGroupId);
}
