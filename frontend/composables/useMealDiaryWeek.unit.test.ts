import { reactive, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const limits = ref<{ maxWeeksAhead: number } | null>(null);
const canNavigateToWeek = vi.fn(() => true);
const route = reactive({ path: '/diary', query: { week: '2026-10-23' } });
const router = { replace: vi.fn() };
const mealDiaryStore = {
  currentWeekStart: null as string | null,
  loading: false,
  lastFetchError: null,
  hydrateFromStorage: vi.fn(),
  fetchWeeklyMeals: vi.fn(),
  getWeekStartDate: () => new Date(2026, 9, 19),
};
const userStore = {
  user: { family_group_id: 4 } as { family_group_id?: number } | null,
  fetchUser: vi.fn(),
};

vi.mock('~/stores/mealDiary', () => ({
  useMealDiaryStore: () => mealDiaryStore,
}));

vi.mock('~/stores/user', () => ({
  useUserStore: () => userStore,
}));

vi.mock('~/composables/useEntitlements', () => ({
  useEntitlements: () => ({ canNavigateToWeek, limits }),
}));

import { useMealDiaryWeek } from './useMealDiaryWeek';

describe('useMealDiaryWeek', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('useRoute', () => route);
    vi.stubGlobal('useRouter', () => router);
    route.query.week = '2026-10-23';
    userStore.user = { family_group_id: 4 };
    limits.value = null;
  });

  it('resolves the query week to its Monday and skips a no-op URL update', async () => {
    const week = useMealDiaryWeek();
    expect(week.resolvedWeekKey.value).toBe('2026-10-19');
    expect(week.displayWeekStartDate.value).toEqual(new Date(2026, 9, 19));
    expect(week.isCurrentWeek.value).toBe(true);

    await week.setWeek(new Date(2026, 9, 23));
    expect(router.replace).not.toHaveBeenCalled();

    await week.setWeek(new Date(2026, 9, 26));
    expect(router.replace).toHaveBeenCalledWith({
      path: '/diary',
      query: { week: '2026-10-26' },
    });
  });

  it('hydrates once and loads the week for the signed-in family', async () => {
    const week = useMealDiaryWeek();
    await week.ensureWeekLoaded();
    await week.refreshWeek();

    expect(mealDiaryStore.hydrateFromStorage).toHaveBeenCalledTimes(1);
    expect(mealDiaryStore.fetchWeeklyMeals).toHaveBeenLastCalledWith(new Date(2026, 9, 19), true);

    userStore.user = null;
    userStore.fetchUser.mockImplementation(async () => {
      userStore.user = null;
    });
    await week.ensureWeekLoaded();
    expect(userStore.fetchUser).toHaveBeenCalled();
  });
});
