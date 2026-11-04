import { OFFLINE_REQUEST_TIMEOUT_MS, resolveStaleFetch } from '@meal-diary/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { apiFetch, ApiError } from '@/lib/api/client';
import { isNetworkError } from '@/lib/auth/httpError';
import {
  bumpMealDiaryFetchRevision,
  readMealDiaryFetchRevision,
} from '@/lib/diary/mealDiaryFetchRevision';
import { loadMealDiaryPendingQueue } from '@/lib/diary/mealDiaryPendingQueue';
import { overlayPendingSlots } from '@/lib/diary/mealDiarySlotState';
import {
  loadWeeklyMealsCache,
  saveWeeklyMealsCache,
} from '@/lib/diary/mealDiaryStorage';
import type { DailyMeal, SaveDailyMealPayload } from '@/types/mealDiary';

const WEEKLY_MEALS_STALE_MS = 5 * 60 * 1000;

export const mealDiaryKeys = {
  all: ['mealDiary'] as const,
  weekly: (familyGroupId: number, weekKey: string) =>
    ['mealDiary', familyGroupId, weekKey] as const,
};

export async function fetchWeeklyMeals(
  familyGroupId: number,
  weekKey: string
): Promise<DailyMeal[]> {
  const meals = await apiFetch<DailyMeal[]>(
    `/meal-diaries/${familyGroupId}/daily-meals?week_start_date=${encodeURIComponent(weekKey)}`,
    { timeoutMs: OFFLINE_REQUEST_TIMEOUT_MS }
  );

  return meals.map((meal) => ({
    ...meal,
    week_start_date: weekKey,
  }));
}

export function retryUnlessOffline(failureCount: number, error: unknown): boolean {
  if (isNetworkError(error)) {
    return false;
  }
  return failureCount < 2;
}

async function fetchWeeklyMealsWithCache(
  queryClient: QueryClient,
  familyGroupId: number,
  weekKey: string
): Promise<DailyMeal[]> {
  const revisionAtStart = readMealDiaryFetchRevision(familyGroupId, weekKey);
  try {
    const meals = await fetchWeeklyMeals(familyGroupId, weekKey);
    const current = queryClient.getQueryData<DailyMeal[]>(
      mealDiaryKeys.weekly(familyGroupId, weekKey)
    );
    const fetched = resolveStaleFetch(
      revisionAtStart,
      readMealDiaryFetchRevision(familyGroupId, weekKey),
      current,
      meals
    );
    if (fetched === current && current) {
      return current;
    }
    await saveWeeklyMealsCache(familyGroupId, weekKey, fetched);
    const pending = await loadMealDiaryPendingQueue(familyGroupId);
    return overlayPendingSlots(fetched, weekKey, pending);
  } catch (error) {
    const cached = await loadWeeklyMealsCache(familyGroupId, weekKey);
    if (cached) {
      const pending = await loadMealDiaryPendingQueue(familyGroupId);
      return overlayPendingSlots(cached.meals, weekKey, pending);
    }
    throw error;
  }
}

export async function saveDailyMeal(
  familyGroupId: number,
  payload: SaveDailyMealPayload
): Promise<DailyMeal> {
  const saved = await apiFetch<DailyMeal>(`/meal-diaries/${familyGroupId}/daily-meals`, {
    method: 'PATCH',
    body: payload,
    timeoutMs: OFFLINE_REQUEST_TIMEOUT_MS,
  });

  return {
    ...saved,
    week_start_date: payload.week_start_date,
  };
}

export function useWeeklyMeals(familyGroupId: number | undefined, weekKey: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!familyGroupId || !weekKey) {
      return;
    }

    const queryKey = mealDiaryKeys.weekly(familyGroupId, weekKey);
    if (queryClient.getQueryData(queryKey)) {
      return;
    }

    void (async () => {
      const cached = await loadWeeklyMealsCache(familyGroupId, weekKey);
      if (!cached) {
        return;
      }

      const pending = await loadMealDiaryPendingQueue(familyGroupId);
      queryClient.setQueryData(queryKey, overlayPendingSlots(cached.meals, weekKey, pending));
    })();
  }, [familyGroupId, queryClient, weekKey]);

  return useQuery({
    queryKey: mealDiaryKeys.weekly(familyGroupId ?? 0, weekKey),
    queryFn: () => fetchWeeklyMealsWithCache(queryClient, familyGroupId!, weekKey),
    enabled: !!familyGroupId && !!weekKey,
    staleTime: WEEKLY_MEALS_STALE_MS,
    placeholderData: keepPreviousData,
    retry: retryUnlessOffline,
  });
}

export function useInvalidateWeeklyMeals() {
  const queryClient = useQueryClient();

  return async (familyGroupId: number, weekKey: string) => {
    await queryClient.invalidateQueries({
      queryKey: mealDiaryKeys.weekly(familyGroupId, weekKey),
    });
  };
}

/** Merge PATCH response into week cache without dropping custom meal slots. */
function mergeSavedDailyMeal(
  previous: DailyMeal | undefined,
  savedMeal: DailyMeal,
  payload: SaveDailyMealPayload
): DailyMeal {
  return {
    ...previous,
    ...savedMeal,
    week_start_date: payload.week_start_date,
    slots: savedMeal.slots?.length ? savedMeal.slots : previous?.slots,
  };
}

function updateWeeklyMealsCache(
  weeklyMeals: DailyMeal[] | undefined,
  savedMeal: DailyMeal,
  payload: SaveDailyMealPayload
): DailyMeal[] {
  if (!weeklyMeals) {
    return [mergeSavedDailyMeal(undefined, savedMeal, payload)];
  }

  const existingIndex = weeklyMeals.findIndex((meal) => meal.day_of_week === savedMeal.day_of_week);
  if (existingIndex === -1) {
    return [...weeklyMeals, mergeSavedDailyMeal(undefined, savedMeal, payload)];
  }

  const next = [...weeklyMeals];
  next[existingIndex] = mergeSavedDailyMeal(weeklyMeals[existingIndex], savedMeal, payload);
  return next;
}

export function useSaveDailyMeal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      familyGroupId,
      payload,
    }: {
      familyGroupId: number;
      payload: SaveDailyMealPayload;
    }) => saveDailyMeal(familyGroupId, payload),
    onSuccess: (savedMeal, { familyGroupId, payload }) => {
      const queryKey = mealDiaryKeys.weekly(familyGroupId, payload.week_start_date);
      bumpMealDiaryFetchRevision(familyGroupId, payload.week_start_date);

      queryClient.setQueryData<DailyMeal[]>(queryKey, (weeklyMeals) => {
        const next = updateWeeklyMealsCache(weeklyMeals, savedMeal, payload);
        void saveWeeklyMealsCache(familyGroupId, payload.week_start_date, next);
        return next;
      });
    },
  });
}

export function resolveMealDiaryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load meal diary';
}
