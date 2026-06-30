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

    <div
      v-if="isWeekReadOnly"
      class="alert alert-info mx-4 mb-4"
      role="status"
      data-testid="diary-week-read-only-alert"
    >
      <div class="flex flex-col gap-2 w-full sm:flex-row sm:items-center sm:justify-between">
        <div class="flex flex-col gap-1">
          <span>{{ $t('diaryPage.weekReadOnly') }}</span>
          <span v-if="!billing.isOwner" class="text-sm">{{ weekReadOnlyHelperText }}</span>
        </div>
        <NuxtLink
          v-if="billing.isOwner"
          class="btn btn-primary btn-sm w-fit shrink-0"
          to="/plans"
          data-testid="diary-week-read-only-upgrade"
        >
          {{ $t('diaryPage.upgradeLink') }}
        </NuxtLink>
      </div>
    </div>

    <MealDiarySkeleton v-if="showSkeleton" />
    <div v-else class="relative">
      <WeekCalendarPicker
        :key="resolvedWeekKey"
        :initialWeekStartDate="displayWeekStartDate"
        :is-current-week="isCurrentWeek"
        :can-select-week="canSelectWeek"
        @weekChange="handleWeekChange"
        @go-to-this-week="handleGoToThisWeek"
        @weekBlocked="handleWeekBlocked"
      />
      <div
        class="relative"
        :class="{ 'opacity-50 pointer-events-none': showWeekLoading }"
      >
        <DayFoodPlanCard
          v-for="dayMeal in mealDiaryStore.weeklyMeals"
          :key="`${resolvedWeekKey}-${dayMeal.day_of_week}`"
          :day="getDayName(dayMeal.day_of_week, dayMeal.week_start_date)"
          :date="getDateForDay(dayMeal.week_start_date, dayMeal.day_of_week)"
          :breakfast="{ name: dayMeal.breakfast, recipeId: dayMeal.breakfast_recipe_id }"
          :lunch="{ name: dayMeal.lunch, recipeId: dayMeal.lunch_recipe_id }"
          :dinner="{ name: dayMeal.dinner, recipeId: dayMeal.dinner_recipe_id }"
          :isPastDay="isDayInPast(dayMeal.week_start_date, dayMeal.day_of_week)"
          :readOnly="isWeekReadOnly"
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
import { useToast } from '~/composables/useToast';

const { pullToRefreshEnabled } = usePullToRefreshEnabled();
const mealDiaryStore = useMealDiaryStore();
const { showSuccess } = useToast();
const { track } = useAnalytics();
const { refreshEntitlements, canNavigateToWeek, isWeekReadOnly: checkWeekReadOnly, billing } = useEntitlements();
const { openPaywall } = usePaywall();

onMounted(() => {
  track('diary_viewed');
  void refreshEntitlements(true);
});
const { t } = useI18n();
const { getDayName, getDateForDay, isDayInPast } = useDateUtils();

const {
  resolvedWeekKey,
  displayWeekStartDate,
  loading,
  lastFetchError,
  setWeek,
  refreshWeek,
  isCurrentWeek,
  goToCurrentWeek,
} = useMealDiaryWeek();

const hasMealData = computed(() => mealDiaryStore.weeklyMeals?.length > 0);
const showSkeleton = computed(() => loading.value && !hasMealData.value);
const showWeekLoading = computed(() => loading.value && hasMealData.value);

const isWeekReadOnly = computed(() => {
  if (!displayWeekStartDate.value) {
    return false;
  }

  return checkWeekReadOnly(displayWeekStartDate.value);
});

const weekReadOnlyHelperText = computed(() => {
  if (billing.value.ownerDisplayName) {
    return t('diaryPage.askOwnerToUpgrade', { name: billing.value.ownerDisplayName });
  }

  return t('diaryPage.askOwnerToUpgradeGeneric');
});

const canSelectWeek = (weekStart) => canNavigateToWeek(weekStart);

const handleSetMeal = (mealType, dayOfWeek) => {
  if (isWeekReadOnly.value) {
    openPaywall('edit_past_weeks');
    return;
  }

  mealDiaryStore.setSelectedMeal(mealType, dayOfWeek);
  set_meal_modal.showModal();
};

const handleSaveMeal = async () => {
  try {
    await mealDiaryStore.saveMeal();
    track('diary_meal_saved');
    set_meal_modal.close();
    showSuccess(t('Meal saved'));
  } catch (error) {
    console.error('Error saving meal:', error);
  }
};

const handleWeekChange = (weekStartDate) => {
  track('diary_week_changed');
  void setWeek(weekStartDate);
};

const handleGoToThisWeek = () => {
  void goToCurrentWeek();
};

const handleWeekBlocked = () => {
  openPaywall('weeks_ahead');
};

const handleRetry = () => {
  void refreshWeek();
};
</script>
