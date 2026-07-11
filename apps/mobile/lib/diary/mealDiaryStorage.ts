import AsyncStorage from '@react-native-async-storage/async-storage';

import { normalizeMealDiaryWeekKey } from '@/lib/diary/mealDiaryWeekKey';
import type { DailyMeal } from '@/types/mealDiary';

const CACHE_PREFIX = 'meal-diary-cache';
export const MEAL_DIARY_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedWeeklyMeals {
  meals: DailyMeal[];
  lastFetchTime: number;
}

function buildCacheKey(familyGroupId: number, weekKey: string): string {
  return `${CACHE_PREFIX}:${familyGroupId}:${weekKey}`;
}

function normalizeCachedMeals(meals: DailyMeal[], weekKey: string): DailyMeal[] {
  return meals.map((meal) => ({
    ...meal,
    week_start_date: normalizeMealDiaryWeekKey(meal.week_start_date || weekKey),
  }));
}

export function isWeeklyMealsCacheFresh(lastFetchTime: number, now = Date.now()): boolean {
  return now - lastFetchTime <= MEAL_DIARY_CACHE_TTL_MS;
}

export async function loadWeeklyMealsCache(
  familyGroupId: number,
  weekKey: string
): Promise<CachedWeeklyMeals | null> {
  try {
    const raw = await AsyncStorage.getItem(buildCacheKey(familyGroupId, weekKey));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachedWeeklyMeals;
    if (!Array.isArray(parsed.meals) || typeof parsed.lastFetchTime !== 'number') {
      await AsyncStorage.removeItem(buildCacheKey(familyGroupId, weekKey));
      return null;
    }

    return {
      meals: normalizeCachedMeals(parsed.meals, weekKey),
      lastFetchTime: parsed.lastFetchTime,
    };
  } catch (error) {
    console.warn('[mealDiaryStorage] Failed to load cache', error);
    await AsyncStorage.removeItem(buildCacheKey(familyGroupId, weekKey));
    return null;
  }
}

export async function saveWeeklyMealsCache(
  familyGroupId: number,
  weekKey: string,
  meals: DailyMeal[],
  lastFetchTime = Date.now()
): Promise<void> {
  try {
    const payload: CachedWeeklyMeals = {
      meals: normalizeCachedMeals(meals, weekKey),
      lastFetchTime,
    };
    await AsyncStorage.setItem(buildCacheKey(familyGroupId, weekKey), JSON.stringify(payload));
  } catch (error) {
    console.warn('[mealDiaryStorage] Failed to save cache', error);
  }
}

export async function clearMealDiaryCache(familyGroupId?: number): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const prefix = familyGroupId ? `${CACHE_PREFIX}:${familyGroupId}:` : `${CACHE_PREFIX}:`;
    const cacheKeys = keys.filter((key) => key.startsWith(prefix));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (error) {
    console.warn('[mealDiaryStorage] Failed to clear cache', error);
  }
}
