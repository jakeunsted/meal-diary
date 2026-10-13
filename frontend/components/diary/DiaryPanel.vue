<template>
  <div class="flex h-full min-h-0 flex-col" :data-testid="`diary-panel-${variant}`">
    <div class="shrink-0">
      <div class="mx-3 my-3 flex items-center justify-end">
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle"
          data-testid="diary-settings-button"
          :aria-label="$t('diarySettings.open')"
          @click="handleOpenSettings"
        >
          <fa :icon="['fas', 'cog']" />
        </button>
      </div>

      <div
        v-if="lastFetchError && !loading"
        class="alert alert-error mx-3 mb-3"
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
        class="alert alert-info mx-3 mb-3"
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
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto">
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
          <DiaryWeekBoard v-if="variant === 'wide'" />
          <DiaryWeekStack v-else />
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

<script setup lang="ts">
import SetUpdateMealModal from '~/components/diary/SetUpdateMealModal.vue';
import MealSlotsSettingsModal from '~/components/diary/MealSlotsSettingsModal.vue';
import WeekCalendarPicker from '~/components/WeekCalendarPicker.vue';
import MealDiarySkeleton from '~/components/diary/MealDiarySkeleton.vue';
import DiaryWeekBoard from '~/components/diary/DiaryWeekBoard.vue';
import DiaryWeekStack from '~/components/diary/DiaryWeekStack.vue';

defineProps<{
  variant: 'compact' | 'wide';
}>();

const {
  mealDiaryStore,
  mealSlots,
  resolvedWeekKey,
  displayWeekStartDate,
  loading,
  lastFetchError,
  isCurrentWeek,
  showSkeleton,
  showWeekLoading,
  isWeekReadOnly,
  weekReadOnlyHelperText,
  billing,
  canSelectWeek,
  handleOpenSettings,
  handleMealSlotsSaved,
  handleSaveMeal,
  handleWeekChange,
  handleGoToThisWeek,
  handleWeekBlocked,
  handleRetry,
} = provideDiaryScreen();
</script>
