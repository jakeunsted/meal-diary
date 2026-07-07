import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiFetch, ApiError } from '@/lib/api/client';
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
    `/meal-diaries/${familyGroupId}/daily-meals?week_start_date=${encodeURIComponent(weekKey)}`
  );

  return meals.map((meal) => ({
    ...meal,
    week_start_date: weekKey,
  }));
}

export async function saveDailyMeal(
  familyGroupId: number,
  payload: SaveDailyMealPayload
): Promise<DailyMeal> {
  const saved = await apiFetch<DailyMeal>(`/meal-diaries/${familyGroupId}/daily-meals`, {
    method: 'PATCH',
    body: payload,
  });

  return {
    ...saved,
    week_start_date: payload.week_start_date,
  };
}

export function useWeeklyMeals(familyGroupId: number | undefined, weekKey: string) {
  return useQuery({
    queryKey: mealDiaryKeys.weekly(familyGroupId ?? 0, weekKey),
    queryFn: () => fetchWeeklyMeals(familyGroupId!, weekKey),
    enabled: !!familyGroupId && !!weekKey,
    staleTime: WEEKLY_MEALS_STALE_MS,
    placeholderData: keepPreviousData,
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

export function resolveMealDiaryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Failed to load meal diary';
}
