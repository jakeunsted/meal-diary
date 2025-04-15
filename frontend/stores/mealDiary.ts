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
  },
});
