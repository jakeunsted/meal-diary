import { useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import {
  dropMealDiaryPendingQueue,
  dropMealDiaryQueuesExcept,
  getMealDiaryPendingCount,
  getMealDiaryPendingSnapshotVersion,
  loadMealDiaryPendingQueue,
  subscribeMealDiaryPending,
} from '@/lib/diary/mealDiaryPendingQueue';
import {
  flushMealDiaryPending,
  getMealDiarySyncStatus,
  getMealDiarySyncVersion,
  getOpenMealDiaryReview,
  isMealDiaryNetworkOnline,
  setMealDiaryOnlineStatus,
  setMealDiarySyncFamily,
  subscribeMealDiarySync,
  type MealDiaryReview,
  type MealDiarySyncStatus,
} from '@/lib/diary/mealDiarySync';

export function useMealDiarySync(familyGroupId: number | undefined): void {
  const queryClient = useQueryClient();
  const previousFamilyRef = useRef<number | null | undefined>(undefined);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const previousFamilyId = previousFamilyRef.current;
    const nextFamilyId = familyGroupId ?? null;
    previousFamilyRef.current = nextFamilyId;
    setMealDiarySyncFamily(nextFamilyId);

    let cancelled = false;

    const triggerFlush = () => {
      if (cancelled || nextFamilyId == null) {
        return;
      }
      void flushMealDiaryPending(queryClient, nextFamilyId);
    };

    void (async () => {
      if (typeof previousFamilyId === 'number' && previousFamilyId !== nextFamilyId) {
        await dropMealDiaryPendingQueue(previousFamilyId);
      }
      if (nextFamilyId == null || cancelled) {
        return;
      }

      await dropMealDiaryQueuesExcept(nextFamilyId);
      await loadMealDiaryPendingQueue(nextFamilyId);
      if (cancelled) {
        return;
      }

      try {
        const networkState = await Network.getNetworkStateAsync();
        const online = isMealDiaryNetworkOnline(networkState);
        setMealDiaryOnlineStatus(nextFamilyId, online);
        if (online) {
          triggerFlush();
        }
      } catch {
        triggerFlush();
      }
    })();

    const networkSubscription = Network.addNetworkStateListener((state) => {
      if (nextFamilyId == null) {
        return;
      }
      const online = isMealDiaryNetworkOnline(state);
      setMealDiaryOnlineStatus(nextFamilyId, online);
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

const idleStatus: MealDiarySyncStatus = {
  isFlushing: false,
  isOnline: true,
  syncError: false,
  pendingCount: 0,
};

export function useMealDiarySyncStatus(
  familyGroupId: number | undefined
): MealDiarySyncStatus {
  const pendingVersion = useSyncExternalStore(
    subscribeMealDiaryPending,
    getMealDiaryPendingSnapshotVersion,
    getMealDiaryPendingSnapshotVersion
  );
  const syncVersion = useSyncExternalStore(
    subscribeMealDiarySync,
    getMealDiarySyncVersion,
    getMealDiarySyncVersion
  );

  return useMemo(() => {
    if (!familyGroupId || Platform.OS !== 'android') {
      return idleStatus;
    }

    const syncStatus = getMealDiarySyncStatus(familyGroupId);
    return {
      ...syncStatus,
      pendingCount: getMealDiaryPendingCount(familyGroupId),
    };
  }, [familyGroupId, pendingVersion, syncVersion]);
}

export function useMealDiaryReview(): MealDiaryReview | null {
  const syncVersion = useSyncExternalStore(
    subscribeMealDiarySync,
    getMealDiarySyncVersion,
    getMealDiarySyncVersion
  );

  return useMemo(() => {
    if (Platform.OS !== 'android') {
      return null;
    }
    return getOpenMealDiaryReview();
  }, [syncVersion]);
}
