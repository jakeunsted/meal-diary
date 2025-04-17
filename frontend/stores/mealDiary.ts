import { defineStore } from 'pinia';
import { useUserStore } from './user';
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
      return new Date(now.setDate(diff));
    },

    // Fetch daily meals for week from API
    async fetchWeeklyMeals() {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      try {
        if (this.weeklyMeals.length === 0) {
          this.loading = true;
          const weekStartDate = this.getWeekStartDate().toISOString();
          const familyGroupId = userStore.user.family_group_id;
          const response = await $fetch<DailyMeal[]>(`/api/meal-diaries/${familyGroupId}/${weekStartDate}/daily-meals`);
          // Add week_start_date to each meal
          this.weeklyMeals = response.map(meal => ({
            ...meal,
            week_start_date: weekStartDate
          }));
        }
      } catch (error) {
        console.error('Error fetching weekly meals:', error);
        throw error;
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
          week_start_date: this.getWeekStartDate().toISOString(),
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
            week_start_date: this.getWeekStartDate().toISOString(),
            breakfast: this.selectedMeal.type === 'breakfast' ? this.selectedMeal.name : null,
            lunch: this.selectedMeal.type === 'lunch' ? this.selectedMeal.name : null,
            dinner: this.selectedMeal.type === 'dinner' ? this.selectedMeal.name : null
          });
        }

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

    // Initialize SSE connection for real-time updates
    initSSEConnection() {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id) return;

      // Close existing connection if any
      if (this.eventSource) {
        this.eventSource.close();
      }

      // Create new SSE connection
      this.eventSource = new EventSource(`/api/server-sent-events/${userStore.user.family_group_id}`);

      // Handle initial data
      this.eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'initial') {
          // Handle initial data
          if (data.data.mealDiary && data.data.mealDiary.length > 0) {
            // Update weekly meals with initial data
            this.updateMealsFromEvents(data.data.mealDiary);
          }
        } else if (data.type === 'update-daily-meal') {
          // Handle daily meal update
          this.handleDailyMealUpdate(data.data.dailyMeal);
        }
      };

      // Handle connection errors
      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        // Attempt to reconnect after a delay
        setTimeout(() => this.initSSEConnection(), 5000);
      };
    },

    // Update meals from events
    updateMealsFromEvents(events: any[]) {
      // Process events and update weekly meals
      events.forEach(event => {
        if (event.type === 'update-daily-meal') {
          this.handleDailyMealUpdate(event.data.dailyMeal);
        }
      });
    },

    // Handle daily meal update
    handleDailyMealUpdate(dailyMeal: DailyMeal) {
      if (!dailyMeal) return;

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
          week_start_date: this.getWeekStartDate().toISOString()
        });
      }
    },

    // Clean up SSE connection
    cleanupSSEConnection() {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
    }
  },
});
