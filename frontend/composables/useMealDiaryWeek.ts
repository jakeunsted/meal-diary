import { useMealDiaryStore } from '~/stores/mealDiary';
import { useUserStore } from '~/stores/user';
import {
  normalizeMealDiaryWeekKey,
  weekKeysEqual,
  weekStartKeyToLocalDate,
} from '~/composables/mealDiaryWeekKey';

interface EnsureWeekLoadedOptions {
  forceRefresh?: boolean;
}

const WEEK_QUERY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseWeekQueryParam(value: unknown): string {
  if (typeof value !== 'string' || !WEEK_QUERY_PATTERN.test(value.trim())) {
    return '';
  }
  return normalizeMealDiaryWeekKey(value.trim());
}

/**
 * Single entry point for diary week resolution, URL sync, and loading.
 */
export const useMealDiaryWeek = () => {
  const route = useRoute();
  const router = useRouter();
  const mealDiaryStore = useMealDiaryStore();
  const userStore = useUserStore();

  let hasHydratedFromStorage = false;

  const resolvedWeekKey = computed(() => {
    const fromQuery = parseWeekQueryParam(route.query.week);
    if (fromQuery) {
      return fromQuery;
    }
    if (mealDiaryStore.currentWeekStart) {
      return normalizeMealDiaryWeekKey(mealDiaryStore.currentWeekStart);
    }
    return normalizeMealDiaryWeekKey(mealDiaryStore.getWeekStartDate());
  });

  const displayWeekStartDate = computed(() =>
    weekStartKeyToLocalDate(resolvedWeekKey.value)
  );

  const loading = computed(() => mealDiaryStore.loading);
  const lastFetchError = computed(() => mealDiaryStore.lastFetchError);

  const syncWeekToRoute = async (weekKey: string) => {
    const currentQueryWeek = parseWeekQueryParam(route.query.week);
    if (weekKeysEqual(currentQueryWeek, weekKey)) {
      return;
    }
    await router.replace({
      path: route.path,
      query: { ...route.query, week: weekKey },
    });
  };

  const ensureWeekLoaded = async (options: EnsureWeekLoadedOptions = {}) => {
    const { forceRefresh = false } = options;

    if (!userStore.user?.family_group_id) {
      await userStore.fetchUser();
    }
    if (!userStore.user?.family_group_id) {
      return;
    }

    if (!hasHydratedFromStorage) {
      await mealDiaryStore.hydrateFromStorage();
      hasHydratedFromStorage = true;
    }

    const weekKey = resolvedWeekKey.value;
    if (!weekKey) {
      return;
    }

    await syncWeekToRoute(weekKey);
    await mealDiaryStore.fetchWeeklyMeals(
      weekStartKeyToLocalDate(weekKey),
      forceRefresh
    );
  };

  /** Picker / external UI: update URL only; route watch loads data once. */
  const setWeek = async (weekStartDate: Date) => {
    const weekKey = normalizeMealDiaryWeekKey(weekStartDate);
    if (!weekKey) {
      return;
    }
    const currentQueryWeek = parseWeekQueryParam(route.query.week);
    if (weekKeysEqual(currentQueryWeek, weekKey)) {
      return;
    }
    await router.replace({
      path: route.path,
      query: { ...route.query, week: weekKey },
    });
  };

  const refreshWeek = () => ensureWeekLoaded({ forceRefresh: true });

  const currentWeekKey = computed(() =>
    normalizeMealDiaryWeekKey(mealDiaryStore.getWeekStartDate())
  );

  const isCurrentWeek = computed(() =>
    weekKeysEqual(resolvedWeekKey.value, currentWeekKey.value)
  );

  const goToCurrentWeek = () => setWeek(mealDiaryStore.getWeekStartDate());

  watch(
    () => route.query.week,
    (newWeek, oldWeek) => {
      if (newWeek === oldWeek) {
        return;
      }
      void ensureWeekLoaded();
    }
  );

  watch(
    () => userStore.user?.family_group_id,
    (familyGroupId) => {
      if (familyGroupId) {
        void ensureWeekLoaded();
      }
    }
  );

  onMounted(() => {
    void ensureWeekLoaded();
  });

  return {
    resolvedWeekKey,
    displayWeekStartDate,
    loading,
    lastFetchError,
    ensureWeekLoaded,
    setWeek,
    refreshWeek,
    isCurrentWeek,
    goToCurrentWeek,
  };
};
