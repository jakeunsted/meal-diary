import type { InjectionKey } from 'vue';
import { useMealDiaryStore } from '~/stores/mealDiary';
import { useUserStore } from '~/stores/user';

interface DiaryMealSlot {
  id: number;
  name: string;
}

interface SetMealPayload {
  type?: string;
  mealSlotId?: number | null;
}

const openDialog = (id: string) => {
  if (!import.meta.client) {
    return;
  }
  const modal = document.getElementById(id) as HTMLDialogElement | null;
  modal?.showModal();
};

const closeDialog = (id: string) => {
  if (!import.meta.client) {
    return;
  }
  const modal = document.getElementById(id) as HTMLDialogElement | null;
  modal?.close();
};

export const useDiaryScreen = () => {
  const { pullToRefreshEnabled } = usePullToRefreshEnabled();
  const mealDiaryStore = useMealDiaryStore();
  const userStore = useUserStore();
  const { api } = useApi();
  const { showSuccess } = useToast();
  const { track } = useAnalytics();
  const { refreshEntitlements, canNavigateToWeek, isWeekReadOnly: checkWeekReadOnly, billing } = useEntitlements();
  const { openPaywall } = usePaywall();
  const mealSlots = ref<DiaryMealSlot[]>([]);
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

  const canSelectWeek = (weekStart: Date) => canNavigateToWeek(weekStart);

  const handleSetMeal = (payload: string | SetMealPayload, dayOfWeek: number) => {
    if (isWeekReadOnly.value) {
      openPaywall('edit_past_weeks');
      return;
    }

    const type = typeof payload === 'string' ? payload : payload?.type;
    const mealSlotId = typeof payload === 'object' ? payload?.mealSlotId ?? null : null;
    mealDiaryStore.setSelectedMeal(type || '', dayOfWeek, mealSlotId);
    openDialog('set_meal_modal');
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
    openDialog('meal_slots_settings_modal');
  };

  const handleMealSlotsSaved = async () => {
    await fetchMealSlots();
    await refreshWeek();
  };

  const handleSaveMeal = async () => {
    try {
      await mealDiaryStore.saveMeal();
      track('diary_meal_saved');
      closeDialog('set_meal_modal');
      showSuccess(t('Meal saved'));
    } catch (error) {
      console.error('Error saving meal:', error);
    }
  };

  const handleWeekChange = (weekStartDate: Date) => {
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

  onMounted(() => {
    track('diary_viewed');
    void refreshEntitlements(true);
    // Meal-slot drag can leave body touch-action:none if the dialog closed mid-drag.
    document.body.style.removeProperty('touch-action');
    document.body.style.removeProperty('user-select');
  });

  return {
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
  };
};

export type DiaryScreen = ReturnType<typeof useDiaryScreen>;

const diaryScreenKey: InjectionKey<DiaryScreen> = Symbol('diaryScreen');

export const provideDiaryScreen = () => {
  const screen = useDiaryScreen();
  provide(diaryScreenKey, screen);
  return screen;
};

export const useDiaryScreenContext = () => {
  const screen = inject(diaryScreenKey);
  if (!screen) {
    throw new Error('Diary screen is not available');
  }
  return screen;
};
