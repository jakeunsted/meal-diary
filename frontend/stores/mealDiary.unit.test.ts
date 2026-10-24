import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { DailyMeal, MealDiarySyncConflict } from '~/types/MealDiary';

const api = vi.fn();

vi.mock('~/utils/browserStorage', () => ({
  browserStorage: {
    get: vi.fn(() => null),
    set: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock('~/composables/useApi', () => ({
  useApi: () => ({ api }),
}));

vi.mock('~/composables/useToast', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

import { useMealDiaryStore } from './mealDiary';
import { useUserStore } from './user';

const WEEK = '2026-10-19';

const day = (dish: string | null): DailyMeal => ({
  day_of_week: 1,
  week_start_date: WEEK,
  breakfast: dish,
  lunch: null,
  dinner: null,
  breakfast_recipe_id: null,
  lunch_recipe_id: null,
  dinner_recipe_id: null,
  slots: [
    {
      id: 1,
      meal_slot_id: 10,
      name: 'Breakfast',
      position: 0,
      dish,
      recipe_id: null,
      legacy_key: 'breakfast',
    },
  ],
});

const conflict = (dish: string): MealDiarySyncConflict => ({
  week_start_date: WEEK,
  day_of_week: 1,
  meal_slot_id: 10,
  slot_name: 'Breakfast',
  yours: { dish, recipe_id: null },
  theirs: { dish: 'Server', recipe_id: null },
  baseline: { dish: 'Toast', recipe_id: null },
});

describe('meal diary store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    api.mockReset();
    useUserStore().user = { id: 3, family_group_id: 9 } as never;
  });

  it('queues a selected slot and drops it when the edit matches the baseline', async () => {
    const store = useMealDiaryStore();
    store.currentWeekStart = WEEK;
    store.weeklyMeals = [day('Toast')];
    store.selectedMeal = {
      type: 'breakfast',
      mealSlotId: 10,
      dayOfWeek: 1,
      name: 'Eggs',
      recipeId: null,
    };

    await store.queueSelectedSlot();

    expect(store.pendingSlots).toEqual([
      expect.objectContaining({
        family_group_id: 9,
        meal_slot_id: 10,
        dish: 'Eggs',
        baseline: { dish: 'Toast', recipe_id: null },
      }),
    ]);
    expect(store.weeklyMeals[0].slots?.[0].dish).toBe('Eggs');

    store.selectedMeal.name = 'Toast';
    await store.queueSelectedSlot();

    expect(store.pendingSlots).toEqual([]);
    expect(store.weeklyMeals[0].slots?.[0].dish).toBe('Toast');
  });

  it('clears applied slots and records conflicts from a sync response', async () => {
    const store = useMealDiaryStore();
    store.currentWeekStart = WEEK;
    store.weeklyMeals = [day('Eggs')];
    store.pendingSlots = [
      {
        family_group_id: 9,
        week_start_date: WEEK,
        day_of_week: 1,
        meal_slot_id: 10,
        baseline: { dish: 'Toast', recipe_id: null },
        dish: 'Eggs',
        recipe_id: null,
      },
      {
        family_group_id: 9,
        week_start_date: WEEK,
        day_of_week: 2,
        meal_slot_id: 11,
        baseline: { dish: null, recipe_id: null },
        dish: 'Soup',
        recipe_id: null,
      },
    ];

    await store.consumeSyncResponse(WEEK, {
      dailyMeals: [day('Server')],
      results: [
        {
          status: 'applied',
          day_of_week: 2,
          meal_slot_id: 11,
        },
        {
          status: 'conflict',
          day_of_week: 1,
          meal_slot_id: 10,
          yours: { dish: 'Eggs', recipe_id: null },
          theirs: { dish: 'Server', recipe_id: null },
          baseline: { dish: 'Toast', recipe_id: null },
        },
      ],
    });

    expect(store.pendingSlots.map((slot) => slot.meal_slot_id)).toEqual([10]);
    expect(store.conflicts).toEqual([
      expect.objectContaining({
        meal_slot_id: 10,
        yours: { dish: 'Eggs', recipe_id: null },
        theirs: { dish: 'Server', recipe_id: null },
      }),
    ]);
    expect(store.reviewWeekStart).toBe(WEEK);
  });

  it('updates the review list for keep theirs and keep mine', async () => {
    const store = useMealDiaryStore();
    store.currentWeekStart = WEEK;
    store.weeklyMeals = [day('Eggs')];
    store.reviewWeekStart = WEEK;
    store.conflicts = [conflict('Eggs'), { ...conflict('Lunch box'), day_of_week: 2, meal_slot_id: 11 }];
    store.pendingSlots = [
      {
        family_group_id: 9,
        week_start_date: WEEK,
        day_of_week: 1,
        meal_slot_id: 10,
        baseline: { dish: 'Toast', recipe_id: null },
        dish: 'Eggs',
        recipe_id: null,
      },
    ];

    await store.keepTheirs(store.conflicts[0]);
    expect(store.conflicts.map((row) => row.meal_slot_id)).toEqual([11]);

    api.mockResolvedValue({
      dailyMeals: [day('Lunch box')],
      results: [{ status: 'applied', day_of_week: 2, meal_slot_id: 11 }],
    });
    await store.keepMine(store.conflicts[0]);

    expect(api).toHaveBeenCalledWith(
      '/api/meal-diaries/9/daily-meals/sync/resolve',
      expect.objectContaining({ method: 'POST' })
    );
    expect(store.conflicts).toEqual([]);
    expect(store.reviewWeekStart).toBeNull();
  });
});
