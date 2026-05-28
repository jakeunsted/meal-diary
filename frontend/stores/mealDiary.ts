import { defineStore } from 'pinia';
import { startOfISOWeek } from 'date-fns';
import { useUserStore } from './user';
import { Preferences } from '@capacitor/preferences';
import type { MealDiaryState, DailyMeal } from '~/types/MealDiary';
import { useApi } from '~/composables/useApi';
import {
  normalizeMealDiaryWeekKey,
  weekKeysEqual,
  weeklyMealsMatchWeek,
} from '~/composables/mealDiaryWeekKey';

/** Client-side cache TTL for weekly meals (matches fetch + initialize logic). */
const WEEKLY_MEALS_CACHE_MS = 5 * 60 * 1000;

/** Tracks overlapping fetchWeeklyMeals calls so loading stays true until the last one finishes. */
let weeklyMealsFetchDepth = 0;

/** In-flight fetch per week key — duplicate requests share the same promise. */
const inflightWeeklyMeals = new Map<string, Promise<void>>();

/** Batches rapid Preferences writes (e.g. multiple SSE updates). */
let persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const PERSIST_DEBOUNCE_MS = 400;

export const useMealDiaryStore = defineStore('mealDiary', {
  state: (): MealDiaryState => ({
    weeklyMeals: [],
    loading: false,
    selectedMeal: {
      type: null,
      dayOfWeek: null,
      name: '',
      recipeId: null,
    },
    eventSource: null as EventSource | null,
    currentWeekStart: null as string | null,
    lastFetchTime: null as number | null,
    lastFetchError: null as string | null,
  }),

  getters: {
    getDayMeals: (state) => (dayOfWeek: number) => {
      return state.weeklyMeals.find(meal => meal.day_of_week === dayOfWeek);
    },

    isWeekReady: (state) => (weekKey: string) => {
      return (
        weekKeysEqual(state.currentWeekStart, weekKey) &&
        weeklyMealsMatchWeek(state.weeklyMeals, weekKey)
      );
    },
  },

  actions: {
    // Current ISO week Monday at local midnight (matches WeekCalendarPicker)
    getWeekStartDate() {
      const monday = startOfISOWeek(new Date());
      monday.setHours(0, 0, 0, 0);
      return monday;
    },

    // Save to Preferences
    async saveToLocalStorage() {
      if (import.meta.client) {
        const dataToStore = {
          weeklyMeals: this.weeklyMeals,
          currentWeekStart: this.currentWeekStart,
          lastFetchTime: this.lastFetchTime
        };
        await Preferences.set({
          key: 'mealDiary',
          value: JSON.stringify(dataToStore)
        });
      }
    },

    /** Coalesce rapid writes (e.g. SSE bursts) before persisting to Preferences. */
    schedulePersistToLocalStorage() {
      if (!import.meta.client) {
        return;
      }
      if (persistDebounceTimer !== null) {
        clearTimeout(persistDebounceTimer);
      }
      persistDebounceTimer = setTimeout(() => {
        persistDebounceTimer = null;
        void this.saveToLocalStorage();
      }, PERSIST_DEBOUNCE_MS);
    },

    // Load from Preferences
    async loadFromLocalStorage() {
      if (import.meta.client) {
        const { value } = await Preferences.get({ key: 'mealDiary' });
        if (value) {
          try {
            const { weeklyMeals, currentWeekStart, lastFetchTime } = JSON.parse(value);
            if (!Array.isArray(weeklyMeals)) {
              await Preferences.remove({ key: 'mealDiary' });
              return false;
            }
            this.currentWeekStart = currentWeekStart
              ? normalizeMealDiaryWeekKey(currentWeekStart)
              : null;
            this.weeklyMeals = weeklyMeals.map((meal: DailyMeal) => ({
              ...meal,
              week_start_date: normalizeMealDiaryWeekKey(
                meal.week_start_date || this.currentWeekStart || new Date()
              ),
            }));
            this.lastFetchTime = lastFetchTime;
            return true;
          } catch (error) {
            console.error('Failed to parse stored meal diary:', error);
            await Preferences.remove({ key: 'mealDiary' });
          }
        }
      }
      return false;
    },

    /** Load cached diary from Preferences only (no network). */
    async hydrateFromStorage() {
      const authStore = useAuthStore();
      if (!authStore.user?.family_group_id) {
        return;
      }
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) {
        return;
      }
      await this.loadFromLocalStorage();
    },

    /** @deprecated Use hydrateFromStorage — fetch is owned by useMealDiaryWeek on the diary page. */
    async initialize() {
      await this.hydrateFromStorage();
    },

    // Fetch daily meals for week from API
    async fetchWeeklyMeals(weekStartDate?: Date, forceRefresh = false) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      const dateToUse = weekStartDate || this.getWeekStartDate();
      const weekStartDateStr = normalizeMealDiaryWeekKey(dateToUse);
      if (!weekStartDateStr) {
        return;
      }

      const hasDataForWeek = this.isWeekReady(weekStartDateStr);
      const now = Date.now();
      const cacheAge = this.lastFetchTime ? now - this.lastFetchTime : Infinity;

      if (hasDataForWeek && !forceRefresh && cacheAge <= WEEKLY_MEALS_CACHE_MS) {
        return;
      }

      if (!forceRefresh) {
        const existing = inflightWeeklyMeals.get(weekStartDateStr);
        if (existing) {
          return existing;
        }
      } else {
        inflightWeeklyMeals.delete(weekStartDateStr);
      }

      const fetchPromise = this.executeWeeklyMealsFetch(weekStartDateStr, now);
      inflightWeeklyMeals.set(weekStartDateStr, fetchPromise);

      try {
        await fetchPromise;
      } finally {
        if (inflightWeeklyMeals.get(weekStartDateStr) === fetchPromise) {
          inflightWeeklyMeals.delete(weekStartDateStr);
        }
      }
    },

    async executeWeeklyMealsFetch(weekStartDateStr: string, fetchStartedAt: number) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      weeklyMealsFetchDepth += 1;
      this.loading = true;

      try {
        const familyGroupId = userStore.user.family_group_id;
        const { api } = useApi();
        const response = await api(
          `/api/meal-diaries/${familyGroupId}/${weekStartDateStr}/daily-meals`
        );

        this.weeklyMeals = response.map((meal: DailyMeal) => ({
          ...meal,
          week_start_date: weekStartDateStr,
        }));
        this.currentWeekStart = weekStartDateStr;
        this.lastFetchTime = fetchStartedAt;
        this.lastFetchError = null;
        await this.saveToLocalStorage();
      } catch (error: unknown) {
        console.error('Error fetching weekly meals:', error);
        const err = error as { statusCode?: number; status?: number; message?: string };
        const loadedFromStorage = await this.loadFromLocalStorage();
        if (!loadedFromStorage) {
          if (err?.statusCode === 500 || err?.status === 500) {
            console.warn('Meal diary may not exist yet, skipping fetch');
            return;
          }
          this.lastFetchError =
            err?.message || 'Failed to load meal diary';
          throw error;
        }
        this.lastFetchError = null;
      } finally {
        weeklyMealsFetchDepth -= 1;
        if (weeklyMealsFetchDepth < 0) {
          weeklyMealsFetchDepth = 0;
        }
        this.loading = weeklyMealsFetchDepth > 0;
      }
    },

    // Set selected meal for modal
    setSelectedMeal(type: string, dayOfWeek: number) {
      // Find the existing meal for this day
      const existingDayMeal = this.weeklyMeals.find(meal => meal.day_of_week === dayOfWeek);

      // Get the existing meal name if it exists
      const existingMealName = existingDayMeal
        ? existingDayMeal[type as keyof Pick<DailyMeal, 'breakfast' | 'lunch' | 'dinner'>] || ''
        : '';

      // Get the existing recipe ID if it exists
      const recipeIdKey = `${type}_recipe_id` as keyof Pick<DailyMeal, 'breakfast_recipe_id' | 'lunch_recipe_id' | 'dinner_recipe_id'>;
      const existingRecipeId = existingDayMeal
        ? existingDayMeal[recipeIdKey] || null
        : null;

      this.selectedMeal = {
        type,
        dayOfWeek,
        name: existingMealName,
        recipeId: existingRecipeId,
      };
    },

    // Update selected meal name
    updateSelectedMealName(name: string) {
      if (this.selectedMeal) {
        this.selectedMeal.name = name;
      }
    },

    // Update selected meal recipe ID
    updateSelectedMealRecipeId(recipeId: number | null) {
      if (this.selectedMeal) {
        this.selectedMeal.recipeId = recipeId;
      }
    },

    // Save meal to API
    async saveMeal() {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id || !this.selectedMeal.type || !this.selectedMeal.dayOfWeek) return;

      try {
        // Get the existing day meals or create empty values
        const dayMeal = this.weeklyMeals.find(meal => meal.day_of_week === this.selectedMeal.dayOfWeek) || {
          breakfast: null,
          lunch: null,
          dinner: null,
          breakfast_recipe_id: null,
          lunch_recipe_id: null,
          dinner_recipe_id: null,
          day_of_week: this.selectedMeal.dayOfWeek
        };
        // Create a complete meal object with all meal types
        const mealData: any = {
          week_start_date:
            this.currentWeekStart || normalizeMealDiaryWeekKey(this.getWeekStartDate()),
          day_of_week: this.selectedMeal.dayOfWeek,
          breakfast: dayMeal.breakfast || '',
          lunch: dayMeal.lunch || '',
          dinner: dayMeal.dinner || '',
          breakfast_recipe_id: dayMeal.breakfast_recipe_id || null,
          lunch_recipe_id: dayMeal.lunch_recipe_id || null,
          dinner_recipe_id: dayMeal.dinner_recipe_id || null,
        };

        // Update the specific meal type that changed
        const mealType = this.selectedMeal.type as 'breakfast' | 'lunch' | 'dinner';
        mealData[mealType] = this.selectedMeal.name;
        mealData[`${mealType}_recipe_id`] = this.selectedMeal.recipeId;

        const { api } = useApi();
        await api(`/api/meal-diaries/${userStore.user.family_group_id}/daily-meals`, {
          method: 'PATCH',
          body: mealData
        });

        // Update local state
        const existingDayMeal = this.weeklyMeals.find(meal => meal.day_of_week === this.selectedMeal.dayOfWeek);
        if (existingDayMeal) {
          existingDayMeal[mealType] = this.selectedMeal.name;
          const recipeIdKey = `${mealType}_recipe_id` as keyof Pick<DailyMeal, 'breakfast_recipe_id' | 'lunch_recipe_id' | 'dinner_recipe_id'>;
          (existingDayMeal as any)[recipeIdKey] = this.selectedMeal.recipeId;
        } else {
          this.weeklyMeals.push({
            day_of_week: this.selectedMeal.dayOfWeek,
            week_start_date:
              this.currentWeekStart || normalizeMealDiaryWeekKey(this.getWeekStartDate()),
            breakfast: mealType === 'breakfast' ? this.selectedMeal.name : null,
            lunch: mealType === 'lunch' ? this.selectedMeal.name : null,
            dinner: mealType === 'dinner' ? this.selectedMeal.name : null,
            breakfast_recipe_id: mealType === 'breakfast' ? this.selectedMeal.recipeId : null,
            lunch_recipe_id: mealType === 'lunch' ? this.selectedMeal.recipeId : null,
            dinner_recipe_id: mealType === 'dinner' ? this.selectedMeal.recipeId : null,
          });
        }

        await this.saveToLocalStorage();

        // Reset selected meal
        this.selectedMeal = {
          type: null,
          dayOfWeek: null,
          name: '',
          recipeId: null,
        };

      } catch (error) {
        console.error('Error saving meal:', error);
        throw error;
      }
    },

    // Handle daily meal update from SSE
    handleDailyMealUpdate(dailyMeal: DailyMeal) {
      if (!dailyMeal) return;

      const incomingKey = dailyMeal.week_start_date
        ? normalizeMealDiaryWeekKey(dailyMeal.week_start_date)
        : '';
      const currentKey = this.currentWeekStart
        ? normalizeMealDiaryWeekKey(this.currentWeekStart)
        : '';

      if (incomingKey && currentKey && incomingKey !== currentKey) {
        return;
      }

      // Find existing meal for this day
      const existingDayMealIndex = this.weeklyMeals.findIndex(
        meal => meal.day_of_week === dailyMeal.day_of_week
      );

      if (existingDayMealIndex !== -1) {
        const prev = this.weeklyMeals[existingDayMealIndex];
        const next: DailyMeal = {
          ...prev,
          breakfast: dailyMeal.breakfast,
          lunch: dailyMeal.lunch,
          dinner: dailyMeal.dinner,
        };
        const recipeKeys = [
          'breakfast_recipe_id',
          'lunch_recipe_id',
          'dinner_recipe_id',
        ] as const;
        const payload = dailyMeal as unknown as Record<string, unknown>;
        for (const k of recipeKeys) {
          if (k in payload) {
            (next as unknown as Record<string, unknown>)[k] = dailyMeal[k];
          }
        }
        this.weeklyMeals[existingDayMealIndex] = next;
      } else {
        this.weeklyMeals.push({
          ...dailyMeal,
          week_start_date:
            currentKey ||
            incomingKey ||
            normalizeMealDiaryWeekKey(this.getWeekStartDate()),
        });
      }

      // Save to Preferences after receiving update (debounced — SSE can send many events)
      this.schedulePersistToLocalStorage();
    },

    // Update meals from events
    updateMealsFromEvents(events: any[]) {
      // Process events and update weekly meals
      events.forEach(event => {
        if (event.type === 'update-daily-meal') {
          this.handleDailyMealUpdate(event.data.dailyMeal);
        }
      });
    }
  },
});
