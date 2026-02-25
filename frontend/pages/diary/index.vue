<template>
  <div class="max-w-4xl mx-auto">
    <h1 class="text-2xl font-bold text-center m-4">{{ $t('Meal diary') }}</h1>

    <MealDiarySkeleton v-if="!hasMealData" />
    <div v-else>
      <WeekCalendarPicker
        :initialWeekStartDate="currentWeekStartDate"
        @weekChange="handleWeekChange"
      />
      <DayFoodPlanCard
        v-for="(dayMeal, index) in mealDiaryStoreComputed.weeklyMeals"
        :key="index"
        :day="getDayName(dayMeal.day_of_week)"
        :date="getDateForDay(dayMeal.week_start_date, dayMeal.day_of_week)"
        :breakfast="{ name: dayMeal.breakfast, recipeId: dayMeal.breakfast_recipe_id }"
        :lunch="{ name: dayMeal.lunch, recipeId: dayMeal.lunch_recipe_id }"
        :dinner="{ name: dayMeal.dinner, recipeId: dayMeal.dinner_recipe_id }"
        :isPastDay="isDayInPast(dayMeal.week_start_date, dayMeal.day_of_week)"
        @setMeal="(mealType) => handleSetMeal(mealType, dayMeal.day_of_week)"
      />
    </div>

    <dialog id="set_meal_modal" class="modal">
      <SetUpdateMealModal
        v-if="mealDiaryStoreComputed.selectedMeal.type !== null"
        :meal="mealDiaryStoreComputed.selectedMeal.name"
        :recipeId="mealDiaryStoreComputed.selectedMeal.recipeId"
        @update:meal="mealDiaryStoreComputed.updateSelectedMealName"
        @update:recipeId="mealDiaryStoreComputed.updateSelectedMealRecipeId"
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
import { useDateUtils } from '~/composables/useDateUtils.ts';

const mealDiaryStore = useMealDiaryStore();
const userStore = useUserStore();
const { getDayName, getDateForDay, isDayInPast } = useDateUtils();

const mealDiaryStoreComputed = computed(() => mealDiaryStore);
const hasMealData = computed(() => mealDiaryStoreComputed.value.weeklyMeals?.length > 0);

const currentWeekStartDate = computed(() => {
  if (mealDiaryStoreComputed.value.currentWeekStart) {
    return new Date(mealDiaryStoreComputed.value.currentWeekStart);
  }
  return mealDiaryStoreComputed.value.getWeekStartDate();
});

const handleSetMeal = (mealType, dayOfWeek) => {
  mealDiaryStore.setSelectedMeal(mealType, dayOfWeek);
  set_meal_modal.showModal();
};

const handleSaveMeal = async () => {
  try {
    await mealDiaryStoreComputed.value.saveMeal();
    set_meal_modal.close();
  } catch (error) {
    console.error('Error saving meal:', error);
  }
};

const handleWeekChange = (weekStartDate) => {
  mealDiaryStoreComputed.value.fetchWeeklyMeals(weekStartDate);
};

onMounted(() => {
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

  loadData();
});

watch(() => userStore.user?.family_group_id, (newId) => {
  if (newId) {
    mealDiaryStoreComputed.value.fetchWeeklyMeals();
  }
});
</script>
