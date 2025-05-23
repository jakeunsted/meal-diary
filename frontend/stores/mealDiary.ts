import { defineStore } from 'pinia';
import { useUserStore } from './user';
import { Preferences } from '@capacitor/preferences';
import type { MealDiaryState, DailyMeal } from '~/types/MealDiary';

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
          const response = await $fetch<DailyMeal[]>(`/api/meal-diaries/${familyGroupId}/${weekStartDateStr}/daily-meals`);
          
          // Add week_start_date to each meal
          this.weeklyMeals = response.map(meal => ({
            ...meal,
            week_start_date: weekStartDateStr
          }));

          this.lastFetchTime = now;
          // Save to Preferences after successful fetch
          await this.saveToLocalStorage();
        }
      } catch (error) {
        console.error('Error fetching weekly meals:', error);
        // If fetch fails, try to load from Preferences
        const loadedFromStorage = await this.loadFromLocalStorage();
        if (!loadedFromStorage) {
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
      
      this.selectedMeal = {
        type,
        dayOfWeek,
        name: existingMealName,
      };
    },

    // Update selected meal name
    updateSelectedMealName(name: string) {
      if (this.selectedMeal) {
        this.selectedMeal.name = name;
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
          day_of_week: this.selectedMeal.dayOfWeek
        };
        // Create a complete meal object with all meal types
        const mealData = {
          week_start_date: this.currentWeekStart || this.getWeekStartDate().toISOString(),
          day_of_week: this.selectedMeal.dayOfWeek,
          breakfast: dayMeal.breakfast || '',
          lunch: dayMeal.lunch || '',
          dinner: dayMeal.dinner || ''
        };
        
        // Update the specific meal type that changed
        mealData[this.selectedMeal.type as keyof Pick<DailyMeal, 'breakfast' | 'lunch' | 'dinner'>] = this.selectedMeal.name;

        await $fetch(`/api/meal-diaries/${userStore.user.family_group_id}/daily-meals`, {
          method: 'PATCH',
          body: mealData
        });

        // Update local state
        const existingDayMeal = this.weeklyMeals.find(meal => meal.day_of_week === this.selectedMeal.dayOfWeek);
        if (existingDayMeal) {
          existingDayMeal[this.selectedMeal.type as keyof Pick<DailyMeal, 'breakfast' | 'lunch' | 'dinner'>] = this.selectedMeal.name;
        } else {
          // If this is a new day entry, add it to weeklyMeals
          this.weeklyMeals.push({
            day_of_week: this.selectedMeal.dayOfWeek,
            week_start_date: this.currentWeekStart || this.getWeekStartDate().toISOString(),
            breakfast: this.selectedMeal.type === 'breakfast' ? this.selectedMeal.name : null,
            lunch: this.selectedMeal.type === 'lunch' ? this.selectedMeal.name : null,
            dinner: this.selectedMeal.type === 'dinner' ? this.selectedMeal.name : null
          });
        }

        // Save to Preferences after successful update
        await this.saveToLocalStorage();

        // Reset selected meal
        this.selectedMeal = {
          type: null,
          dayOfWeek: null,
          name: '',
        };

      } catch (error) {
        console.error('Error saving meal:', error);
        throw error;
      }
    },

    // Handle daily meal update from SSE
    handleDailyMealUpdate(dailyMeal: DailyMeal) {
      if (!dailyMeal) return;

      // Only process updates for the current week being viewed
      if (dailyMeal.week_start_date !== this.currentWeekStart) {
        console.log('Ignoring update for different week:', {
          receivedWeek: dailyMeal.week_start_date,
          currentWeek: this.currentWeekStart
        });
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
          week_start_date: this.currentWeekStart || this.getWeekStartDate().toISOString()
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
