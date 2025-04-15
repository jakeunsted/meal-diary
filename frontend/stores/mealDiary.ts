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
          this.weeklyMeals = response;
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
      this.selectedMeal = {
        type,
        dayOfWeek,
        name: '',
      };
    },

    // Update selected meal name
    updateSelectedMealName(name: string) {
      this.selectedMeal.name = name;
    },

    // Save meal to API
    async saveMeal() {
      const userStore = useUserStore();
      if (!userStore.user?.family_group_id || !this.selectedMeal.type || !this.selectedMeal.dayOfWeek) return;

      try {
        const updates = {
          [this.selectedMeal.type]: this.selectedMeal.name
        };

        await $fetch(`/api/meal-diaries/${userStore.user.family_group_id}/daily-meals`, {
          method: 'PATCH',
          body: {
            week_start_date: this.getWeekStartDate().toISOString(),
            day_of_week: this.selectedMeal.dayOfWeek,
            ...updates
          }
        });

        // Update local state
        const dayMeal = this.weeklyMeals.find(meal => meal.day_of_week === this.selectedMeal.dayOfWeek);
        if (dayMeal) {
          dayMeal[this.selectedMeal.type as keyof Pick<DailyMeal, 'breakfast' | 'lunch' | 'dinner'>] = this.selectedMeal.name;
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
  },
});
