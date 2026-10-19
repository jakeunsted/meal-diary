import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/errors';
import type { DailyMeal, DayMealSlot } from '@/types/mealDiary';

const apiFetchMock = vi.hoisted(() => vi.fn());
const storage = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    getItem: async (key: string) => store.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: async (key: string) => {
      store.delete(key);
    },
    getAllKeys: async () => [...store.keys()],
    multiRemove: async (keys: string[]) => {
      for (const key of keys) {
        store.delete(key);
      }
    },
  };
});

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: storage,
}));

vi.mock('expo-network', () => ({
  getNetworkStateAsync: vi.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
  addNetworkStateListener: vi.fn(() => ({ remove: () => undefined })),
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: apiFetchMock,
}));

import { applyFamilyRealtimeEvent } from '@/lib/realtime/applyFamilyRealtimeEvent';
import {
  clearAllMealDiaryPendingQueues,
  getMealDiaryPendingSlots,
  recordMealDiaryPendingEdit,
} from '@/lib/diary/mealDiaryPendingQueue';
import {
  flushMealDiaryPending,
  getMealDiarySyncStatus,
  getOpenMealDiaryReview,
  keepMealDiaryMine,
  resetMealDiarySyncState,
  skipMealDiaryReview,
} from '@/lib/diary/mealDiarySync';
import { mealDiaryKeys } from '@/lib/queries/mealDiary';
import { usePaywallStore } from '@/lib/entitlements/paywallStore';

const WEEK = '2026-10-12';
const PREVIOUS_WEEK = '2026-10-05';
const FAMILY_ID = 4;

function mealSlot(
  mealSlotId: number,
  name: string,
  dish: string | null,
  recipeId: number | null,
  legacyKey: DayMealSlot['legacy_key']
): DayMealSlot {
  return {
    id: mealSlotId,
    meal_slot_id: mealSlotId,
    name,
    position: mealSlotId,
    dish,
    recipe_id: recipeId,
    legacy_key: legacyKey,
  };
}

function day(dayOfWeek: number, slots: DayMealSlot[], weekKey = WEEK): DailyMeal {
  const dinner = slots.find((slot) => slot.legacy_key === 'dinner');
  const lunch = slots.find((slot) => slot.legacy_key === 'lunch');
  return {
    day_of_week: dayOfWeek,
    breakfast: null,
    lunch: lunch?.dish ?? null,
    dinner: dinner?.dish ?? null,
    breakfast_recipe_id: null,
    lunch_recipe_id: lunch?.recipe_id ?? null,
    dinner_recipe_id: dinner?.recipe_id ?? null,
    week_start_date: weekKey,
    slots,
  };
}

async function queueSlot(
  weekKey: string,
  dayOfWeek: number,
  mealSlotId: number,
  dish: string,
  recipeId: number | null = null
): Promise<void> {
  await recordMealDiaryPendingEdit(FAMILY_ID, {
    week_start_date: weekKey,
    day_of_week: dayOfWeek,
    meal_slot_id: mealSlotId,
    baseline: { dish: 'Old', recipe_id: null },
    dish,
    recipe_id: recipeId,
  });
}

describe('meal diary sync', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    storage.store.clear();
    apiFetchMock.mockReset();
    await clearAllMealDiaryPendingQueues();
    resetMealDiarySyncState();
    usePaywallStore.setState({ activeFeature: null });
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
  });

  it('applies flush results and opens a review only for conflicts', async () => {
    await queueSlot(WEEK, 1, 10, 'Pasta');
    await queueSlot(WEEK, 1, 11, 'Soup');
    await queueSlot(WEEK, 2, 12, 'Stew', 4);
    await queueSlot(WEEK, 2, 13, 'Gone');
    await queueSlot(WEEK, 3, 14, 'Rejected', 9);

    const serverMeals = [
      day(1, [
        mealSlot(10, 'Dinner', 'Pasta', null, 'dinner'),
        mealSlot(11, 'Lunch', 'Soup', null, 'lunch'),
      ]),
      day(2, [
        mealSlot(12, 'Dinner', 'Their stew', null, 'dinner'),
        mealSlot(13, 'Lunch', null, null, 'lunch'),
      ]),
      day(3, [mealSlot(14, 'Dinner', null, null, 'dinner')]),
    ];

    apiFetchMock.mockResolvedValue({
      dailyMeals: serverMeals,
      results: [
        { day_of_week: 1, meal_slot_id: 10, status: 'applied' },
        { day_of_week: 1, meal_slot_id: 11, status: 'already_saved' },
        {
          day_of_week: 2,
          meal_slot_id: 12,
          status: 'conflict',
          yours: { dish: 'Stew', recipe_id: 4 },
          theirs: { dish: 'Their stew', recipe_id: null },
          baseline: { dish: 'Old', recipe_id: null },
        },
        { day_of_week: 2, meal_slot_id: 13, status: 'slot_removed' },
        { day_of_week: 3, meal_slot_id: 14, status: 'recipe_rejected' },
      ],
    });

    await flushMealDiaryPending(queryClient, FAMILY_ID);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    expect(apiFetchMock.mock.calls[0][0]).toBe(`/meal-diaries/${FAMILY_ID}/daily-meals/sync`);
    expect(getMealDiaryPendingSlots(FAMILY_ID)).toEqual([
      {
        week_start_date: WEEK,
        day_of_week: 2,
        meal_slot_id: 12,
        baseline: { dish: 'Old', recipe_id: null },
        dish: 'Stew',
        recipe_id: 4,
      },
    ]);

    const review = getOpenMealDiaryReview();
    expect(review?.rows).toEqual([
      {
        dayOfWeek: 2,
        mealSlotId: 12,
        yours: { dish: 'Stew', recipe_id: 4 },
        theirs: { dish: 'Their stew', recipe_id: null },
        baseline: { dish: 'Old', recipe_id: null },
      },
    ]);

    const cached = queryClient.getQueryData<DailyMeal[]>(
      mealDiaryKeys.weekly(FAMILY_ID, WEEK)
    );
    const conflictSlot = cached
      ?.find((meal) => meal.day_of_week === 2)
      ?.slots?.find((slot) => slot.meal_slot_id === 12);
    expect(conflictSlot?.dish).toBe('Stew');
    expect(getMealDiarySyncStatus(FAMILY_ID).syncError).toBe(false);
  });

  it('keeps the queue and opens the diary paywall when the week is not entitled', async () => {
    await queueSlot(PREVIOUS_WEEK, 1, 10, 'Pasta');
    apiFetchMock.mockRejectedValue(
      new ApiError(403, 'Upgrade required', {
        code: 'ENTITLEMENT_REQUIRED',
        feature: 'edit_past_weeks',
      })
    );

    await flushMealDiaryPending(queryClient, FAMILY_ID);

    expect(getMealDiaryPendingSlots(FAMILY_ID)).toHaveLength(1);
    expect(getOpenMealDiaryReview()).toBeNull();
    expect(usePaywallStore.getState().activeFeature).toBe('edit_past_weeks');
    expect(getMealDiarySyncStatus(FAMILY_ID).syncError).toBe(false);
  });

  it('flushes one week per request and opens the next conflict week after a skip', async () => {
    await queueSlot(PREVIOUS_WEEK, 1, 10, 'Last week');
    await queueSlot(WEEK, 1, 10, 'This week');

    apiFetchMock.mockImplementation(async (_path: string, options: { body: { week_start_date: string } }) => {
      const weekKey = options.body.week_start_date;
      const dish = weekKey === PREVIOUS_WEEK ? 'Server last week' : 'Server this week';
      return {
        dailyMeals: [day(1, [mealSlot(10, 'Dinner', dish, null, 'dinner')], weekKey)],
        results: [
          {
            day_of_week: 1,
            meal_slot_id: 10,
            status: 'conflict',
            yours: { dish: weekKey === PREVIOUS_WEEK ? 'Last week' : 'This week', recipe_id: null },
            theirs: { dish, recipe_id: null },
            baseline: { dish: 'Old', recipe_id: null },
          },
        ],
      };
    });

    await flushMealDiaryPending(queryClient, FAMILY_ID);

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
    expect(apiFetchMock.mock.calls.map((call) => call[1].body.week_start_date)).toEqual([
      PREVIOUS_WEEK,
      WEEK,
    ]);
    expect(getOpenMealDiaryReview()?.weekStartDate).toBe(PREVIOUS_WEEK);

    await skipMealDiaryReview(queryClient);

    expect(getOpenMealDiaryReview()?.weekStartDate).toBe(WEEK);
    expect(
      getMealDiaryPendingSlots(FAMILY_ID).map((slot) => slot.week_start_date)
    ).toEqual([WEEK]);

    const skippedWeek = queryClient.getQueryData<DailyMeal[]>(
      mealDiaryKeys.weekly(FAMILY_ID, PREVIOUS_WEEK)
    );
    expect(skippedWeek?.[0].slots?.[0].dish).toBe('Server last week');
    expect(skippedWeek?.[0].dinner).toBe('Server last week');
  });

  it('drops unresolved conflicts on skip and leaves an already applied choice in place', async () => {
    await queueSlot(WEEK, 1, 10, 'Keep me', 3);
    await queueSlot(WEEK, 1, 11, 'Drop me');

    const serverMeals = [
      day(1, [
        mealSlot(10, 'Dinner', 'Their dinner', null, 'dinner'),
        mealSlot(11, 'Lunch', 'Their lunch', null, 'lunch'),
      ]),
    ];
    apiFetchMock.mockResolvedValueOnce({
      dailyMeals: serverMeals,
      results: [
        {
          day_of_week: 1,
          meal_slot_id: 10,
          status: 'conflict',
          yours: { dish: 'Keep me', recipe_id: 3 },
          theirs: { dish: 'Their dinner', recipe_id: null },
          baseline: { dish: 'Old', recipe_id: null },
        },
        {
          day_of_week: 1,
          meal_slot_id: 11,
          status: 'conflict',
          yours: { dish: 'Drop me', recipe_id: null },
          theirs: { dish: 'Their lunch', recipe_id: null },
          baseline: { dish: 'Old', recipe_id: null },
        },
      ],
    });

    await flushMealDiaryPending(queryClient, FAMILY_ID);

    apiFetchMock.mockResolvedValueOnce({
      dailyMeals: [
        day(1, [
          mealSlot(10, 'Dinner', 'Keep me', 3, 'dinner'),
          mealSlot(11, 'Lunch', 'Their lunch', null, 'lunch'),
        ]),
      ],
      results: [{ day_of_week: 1, meal_slot_id: 10, status: 'applied' }],
    });

    await keepMealDiaryMine(queryClient, [{ dayOfWeek: 1, mealSlotId: 10 }]);

    expect(apiFetchMock.mock.calls[1][0]).toBe(
      `/meal-diaries/${FAMILY_ID}/daily-meals/sync/resolve`
    );
    expect(apiFetchMock.mock.calls[1][1].body.keep_mine).toEqual([
      {
        day_of_week: 1,
        meal_slot_id: 10,
        dish: 'Keep me',
        recipe_id: 3,
        expected: { dish: 'Their dinner', recipe_id: null },
        baseline: { dish: 'Old', recipe_id: null },
      },
    ]);
    expect(getOpenMealDiaryReview()?.rows.map((row) => row.mealSlotId)).toEqual([11]);

    await skipMealDiaryReview(queryClient);

    expect(getOpenMealDiaryReview()).toBeNull();
    expect(getMealDiaryPendingSlots(FAMILY_ID)).toEqual([]);

    const cached = queryClient.getQueryData<DailyMeal[]>(mealDiaryKeys.weekly(FAMILY_ID, WEEK));
    const dinner = cached?.[0].slots?.find((slot) => slot.meal_slot_id === 10);
    const lunch = cached?.[0].slots?.find((slot) => slot.meal_slot_id === 11);
    expect(dinner?.dish).toBe('Keep me');
    expect(dinner?.recipe_id).toBe(3);
    expect(lunch?.dish).toBe('Their lunch');
    expect(cached?.[0].dinner).toBe('Keep me');
    expect(cached?.[0].lunch).toBe('Their lunch');
  });

  it('leaves a conflict row open when resolve finds the server value has moved', async () => {
    await queueSlot(WEEK, 1, 10, 'Mine');
    apiFetchMock.mockResolvedValueOnce({
      dailyMeals: [day(1, [mealSlot(10, 'Dinner', 'Theirs', null, 'dinner')])],
      results: [
        {
          day_of_week: 1,
          meal_slot_id: 10,
          status: 'conflict',
          yours: { dish: 'Mine', recipe_id: null },
          theirs: { dish: 'Theirs', recipe_id: null },
          baseline: { dish: 'Old', recipe_id: null },
        },
      ],
    });
    await flushMealDiaryPending(queryClient, FAMILY_ID);

    apiFetchMock.mockResolvedValueOnce({
      dailyMeals: [day(1, [mealSlot(10, 'Dinner', 'Moved', null, 'dinner')])],
      results: [
        {
          day_of_week: 1,
          meal_slot_id: 10,
          status: 'conflict',
          yours: { dish: 'Mine', recipe_id: null },
          theirs: { dish: 'Moved', recipe_id: null },
          baseline: { dish: 'Theirs', recipe_id: null },
        },
      ],
    });

    await keepMealDiaryMine(queryClient);

    const review = getOpenMealDiaryReview();
    expect(review?.rows).toEqual([
      {
        dayOfWeek: 1,
        mealSlotId: 10,
        yours: { dish: 'Mine', recipe_id: null },
        theirs: { dish: 'Moved', recipe_id: null },
        baseline: { dish: 'Theirs', recipe_id: null },
      },
    ]);
    expect(getMealDiaryPendingSlots(FAMILY_ID)[0]?.baseline).toEqual({
      dish: 'Theirs',
      recipe_id: null,
    });
  });

  it('keeps a pending slot in place when a realtime day update arrives', () => {
    const previous = day(1, [
      mealSlot(10, 'Dinner', 'Local stew', 4, 'dinner'),
      mealSlot(11, 'Lunch', 'Old salad', null, 'lunch'),
    ]);
    queryClient.setQueryData(mealDiaryKeys.weekly(FAMILY_ID, WEEK), [previous]);

    return recordMealDiaryPendingEdit(FAMILY_ID, {
      week_start_date: WEEK,
      day_of_week: 1,
      meal_slot_id: 10,
      baseline: { dish: 'Old stew', recipe_id: null },
      dish: 'Local stew',
      recipe_id: 4,
    }).then(() => {
      applyFamilyRealtimeEvent(
        queryClient,
        FAMILY_ID,
        'update-daily-meal',
        {
          dailyMeal: {
            day_of_week: 1,
            week_start_date: WEEK,
            breakfast: null,
            lunch: 'Server salad',
            dinner: 'Server stew',
            breakfast_recipe_id: null,
            lunch_recipe_id: null,
            dinner_recipe_id: null,
            slots: [
              mealSlot(10, 'Dinner', 'Server stew', null, 'dinner'),
              mealSlot(11, 'Lunch', 'Server salad', null, 'lunch'),
            ],
          },
        },
        undefined
      );

      const cached = queryClient.getQueryData<DailyMeal[]>(
        mealDiaryKeys.weekly(FAMILY_ID, WEEK)
      );
      const dinner = cached?.[0].slots?.find((slot) => slot.meal_slot_id === 10);
      const lunch = cached?.[0].slots?.find((slot) => slot.meal_slot_id === 11);
      expect(dinner?.dish).toBe('Local stew');
      expect(dinner?.recipe_id).toBe(4);
      expect(cached?.[0].dinner).toBe('Local stew');
      expect(cached?.[0].dinner_recipe_id).toBe(4);
      expect(lunch?.dish).toBe('Server salad');
      expect(cached?.[0].lunch).toBe('Server salad');
      expect(getMealDiaryPendingSlots(FAMILY_ID)).toHaveLength(1);
    });
  });
});
