<template>
  <div class="max-w-4xl mx-auto">
    <PullToRefreshChrome :enabled="pullToRefreshEnabled" :on-refresh="refreshWeek" />
    <div class="relative mx-4 my-4 flex items-center justify-center">
      <h1 class="text-2xl font-bold text-center" data-testid="diary-title">{{ $t('Meal diary') }}</h1>
      <button
        type="button"
        class="btn btn-ghost btn-sm btn-circle absolute right-0"
        data-testid="diary-settings-button"
        :aria-label="$t('diarySettings.open')"
        @click="handleOpenSettings"
      >
        <fa :icon="['fas', 'cog']" />
      </button>
    </div>

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
          :slots="dayMeal.slots || []"
          :isPastDay="isDayInPast(dayMeal.week_start_date, dayMeal.day_of_week)"
          :readOnly="isWeekReadOnly"
          @setMeal="(payload) => handleSetMeal(payload, dayMeal.day_of_week)"
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
        v-if="mealDiaryStore.selectedMeal.type !== null || mealDiaryStore.selectedMeal.mealSlotId !== null"
        :meal="mealDiaryStore.selectedMeal.name"
        :recipeId="mealDiaryStore.selectedMeal.recipeId"
        @update:meal="mealDiaryStore.updateSelectedMealName"
        @update:recipeId="mealDiaryStore.updateSelectedMealRecipeId"
        @saveMeal="handleSaveMeal"
      />
    </dialog>

    <dialog id="meal_slots_settings_modal" class="modal" data-testid="meal-slots-settings-dialog">
      <MealSlotsSettingsModal
        :initial-slots="mealSlots"
        @saved="handleMealSlotsSaved"
      />
    </dialog>
  </div>
</template>

<script setup>
import DayFoodPlanCard from '~/components/diary/DayFoodPlanCard.vue';
import SetUpdateMealModal from '~/components/diary/SetUpdateMealModal.vue';
import MealSlotsSettingsModal from '~/components/diary/MealSlotsSettingsModal.vue';
import WeekCalendarPicker from '~/components/WeekCalendarPicker.vue';
import MealDiarySkeleton from '~/components/diary/MealDiarySkeleton.vue';
import PullToRefreshChrome from '~/components/PullToRefreshChrome.vue';

const {
  pullToRefreshEnabled,
  mealDiaryStore,
  mealSlots,
  resolvedWeekKey,
  displayWeekStartDate,
  loading,
  lastFetchError,
  refreshWeek,
  isCurrentWeek,
  showSkeleton,
  showWeekLoading,
  isWeekReadOnly,
  weekReadOnlyHelperText,
  billing,
  canSelectWeek,
  getDayName,
  getDateForDay,
  isDayInPast,
  handleOpenSettings,
  handleSetMeal,
  handleMealSlotsSaved,
  handleSaveMeal,
  handleWeekChange,
  handleGoToThisWeek,
  handleWeekBlocked,
  handleRetry,
} = useDiaryScreen();
</script>
