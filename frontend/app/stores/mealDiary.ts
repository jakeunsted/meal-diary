import { defineStore } from 'pinia';
import { useUserStore } from './user';
import { Preferences } from '@capacitor/preferences';
import type { MealDiaryState, DailyMeal } from '~/types/MealDiary';
import { useApi } from '~/composables/useApi';
export const useMealDiaryStore = defineStore('mealDiary', {
  state: (): MealDiaryState => ({
    weeklyMeals: [],
    loading: false,
    selectedMeal: {
      type: null,
      dayOfWeek: null,
      name: '',
    },
    eventSource: null as EventSource | null,
    currentWeekStart: null as string | null,
    lastFetchTime: null as number | null,
  }),

  getters: {
    getDayMeals: (state) => (dayOfWeek: number) => {
      return state.weeklyMeals.find(meal => meal.day_of_week === dayOfWeek);
    },
  },

  actions: {
    // Get the current week's start date (Monday)
    getWeekStartDate() {
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const startDate = new Date(now);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
      return startDate;
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

    // Load from Preferences
    async loadFromLocalStorage() {
      if (import.meta.client) {
        const { value } = await Preferences.get({ key: 'mealDiary' });
        if (value) {
          try {
            const { weeklyMeals, currentWeekStart, lastFetchTime } = JSON.parse(value);
            this.weeklyMeals = weeklyMeals;
            this.currentWeekStart = currentWeekStart;
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

    async initialize() {
      const userStore = useUserStore();
      const authStore = useAuthStore();

      if (!authStore.user?.family_group_id) {
        return;
      }

      if (!userStore.user?.family_group_id) {
        return;
      }
      
      // Try to load from Preferences first
      const loadedFromStorage = await this.loadFromLocalStorage();
      
      // Only fetch if we don't have data or if it's too old
      const now = Date.now();
      const cacheAge = this.lastFetchTime ? now - this.lastFetchTime : Infinity;
      const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

      if (!loadedFromStorage || !this.lastFetchTime || cacheAge > CACHE_DURATION) {
        await this.fetchWeeklyMeals();
      }
    },

    // Fetch daily meals for week from API
    async fetchWeeklyMeals(weekStartDate?: Date, forceRefresh = false) {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      try {
        const dateToUse = weekStartDate || this.getWeekStartDate();
        const weekStartDateStr = new Date(dateToUse).toISOString();
        
        // Only fetch if we don't have data for this week or if force refresh is requested
        const hasDataForWeek = this.currentWeekStart === weekStartDateStr && this.weeklyMeals.length > 0;
        const now = Date.now();
        const cacheAge = this.lastFetchTime ? now - this.lastFetchTime : Infinity;
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

        if (!hasDataForWeek || forceRefresh || cacheAge > CACHE_DURATION) {
          this.loading = true;
          this.currentWeekStart = weekStartDateStr;
          
          const familyGroupId = userStore.user.family_group_id;
          const { api } = useApi();
          const response = await api(`/api/meal-diaries/${familyGroupId}/${weekStartDateStr}/daily-meals`);
          
          // Add week_start_date to each meal
          this.weeklyMeals = response.map((meal: DailyMeal) => ({
            ...meal,
            week_start_date: weekStartDateStr
          }));

          this.lastFetchTime = now;
          // Save to Preferences after successful fetch
          await this.saveToLocalStorage();
        }
      } catch (error: any) {
        console.error('Error fetching weekly meals:', error);
        // If fetch fails, try to load from Preferences
        const loadedFromStorage = await this.loadFromLocalStorage();
        if (!loadedFromStorage) {
          if (error?.statusCode === 500 || error?.status === 500) {
            console.warn('Meal diary may not exist yet, skipping fetch');
            return;
          }
          throw error;
        }
      } finally {
        this.loading = false;
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
          week_start_date: this.currentWeekStart || this.getWeekStartDate().toISOString(),
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
            week_start_date: this.currentWeekStart || this.getWeekStartDate().toISOString(),
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

      // Normalize week_start_date for comparison (handle both Date objects and strings)
      const incomingWeekStart = dailyMeal.week_start_date 
        ? (typeof dailyMeal.week_start_date === 'string' 
            ? dailyMeal.week_start_date 
            : new Date(dailyMeal.week_start_date).toISOString())
        : null;
      
      const currentWeekStart = this.currentWeekStart;

      // Only process updates for the current week being viewed
      // Compare normalized ISO strings
      if (incomingWeekStart && currentWeekStart && incomingWeekStart !== currentWeekStart) {
        return;
      }

      // Find existing meal for this day
      const existingDayMealIndex = this.weeklyMeals.findIndex(
        meal => meal.day_of_week === dailyMeal.day_of_week
      );

      if (existingDayMealIndex !== -1) {
        // Update existing meal
        this.weeklyMeals[existingDayMealIndex] = {
          ...this.weeklyMeals[existingDayMealIndex],
          breakfast: dailyMeal.breakfast,
          lunch: dailyMeal.lunch,
          dinner: dailyMeal.dinner
        };
      } else {
        // Add new meal
        this.weeklyMeals.push({
          ...dailyMeal,
          week_start_date: currentWeekStart || this.getWeekStartDate().toISOString()
        });
      }

      // Save to Preferences after receiving update
      this.saveToLocalStorage();
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
