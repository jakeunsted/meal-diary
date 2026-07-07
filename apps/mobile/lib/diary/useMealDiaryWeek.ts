import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getCurrentWeekStartDate,
  normalizeMealDiaryWeekKey,
  weekKeysEqual,
  weekStartKeyToLocalDate,
} from '@/lib/diary/mealDiaryWeekKey';
import {
  resolveMealDiaryErrorMessage,
  useWeeklyMeals,
} from '@/lib/queries/mealDiary';
import type { DailyMeal } from '@/types/mealDiary';

const WEEK_QUERY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseWeekQueryParam(value: unknown): string {
  if (typeof value !== 'string' || !WEEK_QUERY_PATTERN.test(value.trim())) {
    return '';
  }
  return normalizeMealDiaryWeekKey(value.trim());
}

function resolveWeekParam(week: string | string[] | undefined): string {
  const raw = Array.isArray(week) ? week[0] : week;
  return parseWeekQueryParam(raw);
}

export interface UseMealDiaryWeekResult {
  resolvedWeekKey: string;
  displayWeekStartDate: Date;
  weeklyMeals: DailyMeal[];
  loading: boolean;
  isFetching: boolean;
  lastFetchError: string | null;
  setWeek: (weekStartDate: Date) => void;
  refreshWeek: () => Promise<unknown>;
  isCurrentWeek: boolean;
  goToCurrentWeek: () => void;
}

export function useMealDiaryWeek(familyGroupId: number | undefined): UseMealDiaryWeekResult {
  const router = useRouter();
  const { week: weekParam } = useLocalSearchParams<{ week?: string | string[] }>();

  const [weekKey, setWeekKeyState] = useState(() => {
    const fromParam = resolveWeekParam(weekParam);
    return fromParam || getCurrentWeekStartDate();
  });

  useEffect(() => {
    const fromParam = resolveWeekParam(weekParam);
    if (fromParam && !weekKeysEqual(fromParam, weekKey)) {
      setWeekKeyState(fromParam);
    }
  }, [weekParam, weekKey]);

  const resolvedWeekKey = useMemo(() => {
    const fromParam = resolveWeekParam(weekParam);
    if (fromParam) {
      return fromParam;
    }
    return weekKey || getCurrentWeekStartDate();
  }, [weekParam, weekKey]);

  const displayWeekStartDate = useMemo(
    () => weekStartKeyToLocalDate(resolvedWeekKey),
    [resolvedWeekKey]
  );

  const weeklyMealsQuery = useWeeklyMeals(familyGroupId, resolvedWeekKey);

  const syncWeekToRoute = useCallback(
    (key: string) => {
      const currentParam = resolveWeekParam(weekParam);
      if (weekKeysEqual(currentParam, key)) {
        return;
      }
      router.setParams({ week: key });
    },
    [router, weekParam]
  );

  const setWeek = useCallback(
    (weekStartDate: Date) => {
      const key = normalizeMealDiaryWeekKey(weekStartDate);
      if (!key || weekKeysEqual(key, resolvedWeekKey)) {
        return;
      }
      setWeekKeyState(key);
      syncWeekToRoute(key);
    },
    [resolvedWeekKey, syncWeekToRoute]
  );

  const goToCurrentWeek = useCallback(() => {
    setWeek(new Date());
  }, [setWeek]);

  const refreshWeek = useCallback(() => {
    return weeklyMealsQuery.refetch();
  }, [weeklyMealsQuery]);

  const isCurrentWeek = weekKeysEqual(resolvedWeekKey, getCurrentWeekStartDate());

  return {
    resolvedWeekKey,
    displayWeekStartDate,
    weeklyMeals: weeklyMealsQuery.data ?? [],
    loading: weeklyMealsQuery.isLoading,
    isFetching: weeklyMealsQuery.isFetching,
    lastFetchError: weeklyMealsQuery.error
      ? resolveMealDiaryErrorMessage(weeklyMealsQuery.error)
      : null,
    setWeek,
    refreshWeek,
    isCurrentWeek,
    goToCurrentWeek,
  };
}
