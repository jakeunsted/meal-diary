<template>
  <div class="max-w-4xl mx-auto">
    <PullToRefreshChrome :enabled="pullToRefreshEnabled" :on-refresh="refreshWeek" />
    <h1 class="text-2xl font-bold text-center m-4" data-testid="diary-title">{{ $t('Meal diary') }}</h1>

    <div
      v-if="lastFetchError && !loading"
      class="alert alert-error mx-4 mb-4"
      role="alert"
      data-testid="diary-load-error"
    >
      <span>{{ $t('Failed to load meal diary') }}</span>
      <button
        type="button"
        class="btn btn-sm btn-ghost"
        data-testid="diary-retry-button"
        @click="handleRetry"
      >
        {{ $t('Retry') }}
      </button>
    </div>

    <MealDiarySkeleton v-if="showSkeleton" />
    <div v-else class="relative">
      <WeekCalendarPicker
        :key="resolvedWeekKey"
        :initialWeekStartDate="displayWeekStartDate"
        @weekChange="handleWeekChange"
      />
      <div
        class="relative"
        :class="{ 'opacity-50 pointer-events-none': showWeekLoading }"
      >
        <DayFoodPlanCard
          v-for="dayMeal in mealDiaryStore.weeklyMeals"
          :key="dayMeal.day_of_week"
          :day="getDayName(dayMeal.day_of_week, dayMeal.week_start_date)"
          :date="getDateForDay(dayMeal.week_start_date, dayMeal.day_of_week)"
          :breakfast="{ name: dayMeal.breakfast, recipeId: dayMeal.breakfast_recipe_id }"
          :lunch="{ name: dayMeal.lunch, recipeId: dayMeal.lunch_recipe_id }"
          :dinner="{ name: dayMeal.dinner, recipeId: dayMeal.dinner_recipe_id }"
          :isPastDay="isDayInPast(dayMeal.week_start_date, dayMeal.day_of_week)"
          @setMeal="(mealType) => handleSetMeal(mealType, dayMeal.day_of_week)"
        />
      </div>
      <div
        v-if="showWeekLoading"
        class="absolute inset-0 flex items-center justify-center z-10"
        aria-busy="true"
        data-testid="diary-week-loading"
      >
        <span class="loading loading-spinner loading-lg text-primary" />
      </div>
    </div>

    <dialog id="set_meal_modal" class="modal" data-testid="set-meal-modal">
      <SetUpdateMealModal
        v-if="mealDiaryStore.selectedMeal.type !== null"
        :meal="mealDiaryStore.selectedMeal.name"
        :recipeId="mealDiaryStore.selectedMeal.recipeId"
        @update:meal="mealDiaryStore.updateSelectedMealName"
        @update:recipeId="mealDiaryStore.updateSelectedMealRecipeId"
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
import DayFoodPlanCard from '~/components/diary/DayFoodPlanCard.vue';
import SetUpdateMealModal from '~/components/diary/SetUpdateMealModal.vue';
import WeekCalendarPicker from '~/components/WeekCalendarPicker.vue';
import MealDiarySkeleton from '~/components/diary/MealDiarySkeleton.vue';
import PullToRefreshChrome from '~/components/PullToRefreshChrome.vue';
import { useDateUtils } from '~/composables/useDateUtils.ts';
import { usePullToRefreshEnabled } from '~/composables/usePullToRefreshEnabled';
import { useMealDiaryWeek } from '~/composables/useMealDiaryWeek';

const { pullToRefreshEnabled } = usePullToRefreshEnabled();
const mealDiaryStore = useMealDiaryStore();
const { getDayName, getDateForDay, isDayInPast } = useDateUtils();

const {
  resolvedWeekKey,
  displayWeekStartDate,
  loading,
  lastFetchError,
  setWeek,
  refreshWeek,
} = useMealDiaryWeek();

const hasMealData = computed(() => mealDiaryStore.weeklyMeals?.length > 0);
const showSkeleton = computed(() => loading.value && !hasMealData.value);
const showWeekLoading = computed(() => loading.value && hasMealData.value);

const handleSetMeal = (mealType, dayOfWeek) => {
  mealDiaryStore.setSelectedMeal(mealType, dayOfWeek);
  set_meal_modal.showModal();
};

const handleSaveMeal = async () => {
  try {
    await mealDiaryStore.saveMeal();
    set_meal_modal.close();
  } catch (error) {
    console.error('Error saving meal:', error);
  }
};

const handleWeekChange = (weekStartDate) => {
  void setWeek(weekStartDate);
};

const handleRetry = () => {
  void refreshWeek();
};
</script>
