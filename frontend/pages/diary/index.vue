<template>
  <div class="max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold text-center m-4">{{ $t('Meal diary') }}</h1>

    <MealDiarySkeleton v-if="!hasMealData" />
    <div v-else>
      <WeekCalendarPicker @weekChange="handleWeekChange" />
      <DayFoodPlanCard
        v-for="(dayMeal, index) in mealDiaryStoreComputed.weeklyMeals"
        :key="index"
        :day="getDayName(dayMeal.day_of_week)"
        :date="getDateForDay(dayMeal.week_start_date, dayMeal.day_of_week)"
        :breakfast="{ name: dayMeal.breakfast }"
        :lunch="{ name: dayMeal.lunch }"
        :dinner="{ name: dayMeal.dinner }"
        @setMeal="(mealType) => handleSetMeal(mealType, dayMeal.day_of_week)"
      />
    </div>

    <dialog id="set_meal_modal" class="modal">
      <SetUpdateMealModal
        v-if="mealDiaryStoreComputed.selectedMeal.type !== null"
        :meal="mealDiaryStoreComputed.selectedMeal.name"
        @update:meal="mealDiaryStoreComputed.updateSelectedMealName"
        @saveMeal="handleSaveMeal"
      />
    </dialog>
  </div>
</template>

<script setup>
definePageMeta({
  middleware: 'auth'
});

import { useMealDiaryStore } from '~/stores/mealDiary';
import { useUserStore } from '~/stores/user';
import DayFoodPlanCard from '~/components/diary/DayFoodPlanCard.vue';
import SetUpdateMealModal from '~/components/diary/SetUpdateMealModal.vue';
import WeekCalendarPicker from '~/components/WeekCalendarPicker.vue';
import MealDiarySkeleton from '~/components/diary/MealDiarySkeleton.vue';

const mealDiaryStore = useMealDiaryStore();
const userStore = useUserStore();

// Make mealDiaryStore reactive as a computed property
const mealDiaryStoreComputed = computed(() => mealDiaryStore);
const hasMealData = computed(() => mealDiaryStoreComputed.value.weeklyMeals?.length > 0);
// const hasMealData = false

// Convert day number to name
const getDayName = (dayNumber) => {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayNumber - 1];
};

// Calculate the date for a specific day of the week
const getDateForDay = (weekStartDate, dayNumber) => {
  if (!weekStartDate) return '';
  
  try {
    const startDate = new Date(weekStartDate);
    if (isNaN(startDate.getTime())) return '';
    
    const dayOffset = dayNumber - 1; // Subtract 1 because Monday is 1 in our system
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + dayOffset);
    
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  } catch (error) {
    console.error('Error calculating date:', error);
    return '';
  }
};

// Handle opening the meal modal
const handleSetMeal = (mealType, dayOfWeek) => {
  mealDiaryStore.setSelectedMeal(mealType, dayOfWeek);
  set_meal_modal.showModal();
};

// Handle saving the meal
const handleSaveMeal = async () => {
  try {
    await mealDiaryStoreComputed.value.saveMeal();
    set_meal_modal.close();
  } catch (error) {
    // Handle error (maybe show a notification)
    console.error('Error saving meal:', error);
  }
};

// Handle week change from the calendar picker
const handleWeekChange = (weekStartDate) => {
  mealDiaryStoreComputed.value.fetchWeeklyMeals(weekStartDate);
};

// Fetch meals when component mounts
onMounted(() => {
  // Start loading data immediately without waiting
  const loadData = async () => {
    try {
      if (!userStore.user?.family_group_id) {
        await userStore.fetchUser();
      }
      await mealDiaryStoreComputed.value.fetchWeeklyMeals();
    } catch (error) {
      console.error('Error loading meal diary:', error);
    }
  };

  // Start loading data without waiting
  loadData();
});

// Watch for changes in family group ID
watch(() => userStore.user?.family_group_id, (newId) => {
  if (newId) {
    mealDiaryStoreComputed.value.fetchWeeklyMeals();
  }
});
</script>
