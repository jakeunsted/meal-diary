<template>
  <div>
    <h1 class="text-2xl font-bold text-center m-4">{{ $t('Meal diary') }}</h1>

    <div v-if="mealDiaryStoreComputed.loading">
      <div class="flex justify-center mb-4">
        <span class="loading loading-spinner loading-xl"></span>
      </div>
    </div>
    <div v-else>
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
import { useMealDiaryStore } from '~/stores/mealDiary';
import { useUserStore } from '~/stores/user';
import DayFoodPlanCard from '~/components/diary/DayFoodPlanCard.vue';
import SetUpdateMealModal from '~/components/diary/SetUpdateMealModal.vue';

const mealDiaryStore = useMealDiaryStore();
const userStore = useUserStore();

// Make mealDiaryStore reactive as a computed property
const mealDiaryStoreComputed = computed(() => mealDiaryStore);

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

// Fetch meals when component mounts
onMounted(async () => {
  if (userStore.user?.family_group_id) {
    mealDiaryStoreComputed.value.fetchWeeklyMeals();
    mealDiaryStoreComputed.value.initSSEConnection();
  } else {
    await userStore.fetchUser(1);
    mealDiaryStoreComputed.value.fetchWeeklyMeals();
    mealDiaryStoreComputed.value.initSSEConnection();
  }
});

// Watch for changes in family group ID
watch(() => userStore.user?.family_group_id, (newId) => {
  if (newId) {
    mealDiaryStoreComputed.value.fetchWeeklyMeals();
    mealDiaryStoreComputed.value.initSSEConnection();
  }
});

// onUnmounted(() => {
//   mealDiaryStoreComputed.value.cleanupSSEConnection();
// });
</script>
