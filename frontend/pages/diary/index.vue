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
      v-if="showSyncPending"
      class="alert alert-info mx-4 mb-4"
      role="status"
      data-testid="diary-sync-pending"
    >
      <span>{{ $t('diarySync.pending') }}</span>
    </div>

    <div
      v-if="mealDiaryStore.syncFailed"
      class="alert alert-error mx-4 mb-4"
      role="alert"
      data-testid="diary-sync-failed"
    >
      <span>{{ $t('diarySync.syncFailed') }}</span>
      <button
        type="button"
        class="btn btn-sm btn-ghost"
        data-testid="diary-sync-retry"
        @click="handleRetrySync"
      >
        {{ $t('diarySync.retry') }}
      </button>
    </div>

    <div
      v-if="showWeekReadOnlyAlert"
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

    <div
      v-if="showWeekAheadAlert"
      class="alert alert-info mx-4 mb-4"
      role="status"
      data-testid="diary-week-ahead-alert"
    >
      <span>{{ $t('diaryPage.weekAheadLimit') }}</span>
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

    <dialog
      ref="reviewDialog"
      id="diary_sync_review"
      class="modal"
      data-testid="diary-sync-review"
      @close="handleReviewDialogClose"
    >
      <DiarySyncReviewModal
        v-if="reviewRows.length"
        :conflicts="reviewRows"
        :busy="mealDiaryStore.syncing"
        @keep-mine="handleKeepMine"
        @keep-theirs="handleKeepTheirs"
        @keep-all-mine="handleKeepAllMine"
        @keep-all-theirs="handleKeepAllTheirs"
      />
      <form method="dialog" class="modal-backdrop">
        <button type="submit">{{ $t('diarySync.close') }}</button>
      </form>
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
import MealSlotsSettingsModal from '~/components/diary/MealSlotsSettingsModal.vue';
import WeekCalendarPicker from '~/components/WeekCalendarPicker.vue';
import MealDiarySkeleton from '~/components/diary/MealDiarySkeleton.vue';
import DiarySyncReviewModal from '~/components/diary/DiarySyncReviewModal.vue';
import PullToRefreshChrome from '~/components/PullToRefreshChrome.vue';
import { useDateUtils } from '~/composables/useDateUtils.ts';
import { weekKeysEqual } from '~/composables/mealDiaryWeekKey';
import { usePullToRefreshEnabled } from '~/composables/usePullToRefreshEnabled';
import { useMealDiaryWeek } from '~/composables/useMealDiaryWeek';
import { useToast } from '~/composables/useToast';
import { useApi } from '~/composables/useApi';
import { useUserStore } from '~/stores/user';

const { pullToRefreshEnabled } = usePullToRefreshEnabled();
const mealDiaryStore = useMealDiaryStore();
const userStore = useUserStore();
const { api } = useApi();
const { showSuccess } = useToast();
const { track } = useAnalytics();
const { refreshEntitlements, canNavigateToWeek, isWeekReadOnly: checkWeekReadOnly, billing } = useEntitlements();
const { openPaywall } = usePaywall();

const mealSlots = ref([]);

const reviewDialog = ref(null);
let ignoreReviewClose = false;
let leavingDiary = false;

const handleOnline = () => {
  void mealDiaryStore.flushPending();
};

const handleVisibilityChange = () => {
  if (document.visibilityState === 'visible') {
    void mealDiaryStore.flushPending();
  }
};

onMounted(() => {
  track('diary_viewed');
  void refreshEntitlements(true);
  // Meal-slot drag can leave body touch-action:none if the dialog closed mid-drag.
  document.body.style.removeProperty('touch-action');
  document.body.style.removeProperty('user-select');
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

const openWeekEntitlement = computed(() => {
  const week = resolvedWeekKey.value;
  if (!week) {
    return null;
  }
  const match = Object.keys(mealDiaryStore.syncEntitlementByWeek).find((key) =>
    weekKeysEqual(key, week)
  );
  return match ? mealDiaryStore.syncEntitlementByWeek[match] : null;
});

const showWeekReadOnlyAlert = computed(
  () => isWeekReadOnly.value || openWeekEntitlement.value === 'edit_past_weeks'
);

const showWeekAheadAlert = computed(() => openWeekEntitlement.value === 'weeks_ahead');

const showSyncPending = computed(() => {
  if (mealDiaryStore.reviewWeekStart) {
    return false;
  }
  const familyId = userStore.user?.family_group_id;
  const week = resolvedWeekKey.value;
  if (!familyId || !week) {
    return false;
  }
  return mealDiaryStore.pendingSlots.some(
    (slot) => slot.family_group_id === familyId && weekKeysEqual(slot.week_start_date, week)
  );
});

const reviewRows = computed(() => {
  const week = mealDiaryStore.reviewWeekStart;
  if (!week) {
    return [];
  }
  return mealDiaryStore.conflicts.filter((row) => weekKeysEqual(row.week_start_date, week));
});

const canSelectWeek = (weekStart) => canNavigateToWeek(weekStart);

const handleSetMeal = (payload, dayOfWeek) => {
  if (isWeekReadOnly.value) {
    openPaywall('edit_past_weeks');
    return;
  }

  const type = typeof payload === 'string' ? payload : payload?.type;
  const mealSlotId = typeof payload === 'object' ? payload?.mealSlotId ?? null : null;
  mealDiaryStore.setSelectedMeal(type, dayOfWeek, mealSlotId);
  set_meal_modal.showModal();
};

const fetchMealSlots = async () => {
  const familyGroupId = userStore.user?.family_group_id;
  if (!familyGroupId) return;
  try {
    const response = await api(`/api/family-groups/${familyGroupId}/meal-slots`);
    mealSlots.value = response?.slots || [];
  } catch (error) {
    console.error('Failed to load meal slots:', error);
  }
};

const handleOpenSettings = async () => {
  track('diary_settings_opened');
  await fetchMealSlots();
  meal_slots_settings_modal.showModal();
};

const handleMealSlotsSaved = async () => {
  await fetchMealSlots();
  await refreshWeek();
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

const handleRetrySync = () => {
  void mealDiaryStore.flushPending();
};

const handleKeepMine = (conflict) => {
  void mealDiaryStore.keepMine(conflict);
};

const handleKeepTheirs = (conflict) => {
  void mealDiaryStore.keepTheirs(conflict);
};

const handleKeepAllMine = () => {
  void mealDiaryStore.keepAllMine();
};

const handleKeepAllTheirs = () => {
  void mealDiaryStore.keepAllTheirs();
};

const handleReviewDismiss = () => {
  void mealDiaryStore.dismissOpenReview();
};

const handleReviewDialogClose = () => {
  if (ignoreReviewClose || leavingDiary) {
    ignoreReviewClose = false;
    return;
  }
  handleReviewDismiss();
};

const dropReviewOnLeave = () => {
  if (!mealDiaryStore.reviewWeekStart) {
    return;
  }
  leavingDiary = true;
  ignoreReviewClose = true;
  void mealDiaryStore.dismissAllReviews();
};

watch(
  () => mealDiaryStore.reviewWeekStart,
  async (weekStart) => {
    await nextTick();
    const dialog = reviewDialog.value;
    if (!dialog) {
      return;
    }
    if (weekStart) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }
    if (dialog.open) {
      ignoreReviewClose = true;
      dialog.close();
    }
  }
);

onMounted(() => {
  window.addEventListener('online', handleOnline);
  document.addEventListener('visibilitychange', handleVisibilityChange);
  void mealDiaryStore.flushPending();
});

onBeforeUnmount(() => {
  window.removeEventListener('online', handleOnline);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  dropReviewOnLeave();
});

onBeforeRouteLeave(() => {
  dropReviewOnLeave();
});
</script>
