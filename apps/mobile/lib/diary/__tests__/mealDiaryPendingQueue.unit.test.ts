import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import {
  clearAllMealDiaryPendingQueues,
  dropMealDiaryQueuesExcept,
  getMealDiaryPendingSlots,
  loadMealDiaryPendingQueue,
  recordMealDiaryPendingEdit,
} from '@/lib/diary/mealDiaryPendingQueue';

const WEEK = '2026-10-12';

const baseline = { dish: null, recipe_id: null };

describe('meal diary pending queue', () => {
  beforeEach(async () => {
    storage.store.clear();
    await clearAllMealDiaryPendingQueues();
  });

  it('replaces the dish and recipe for a slot and keeps the original baseline', async () => {
    await recordMealDiaryPendingEdit(4, {
      week_start_date: WEEK,
      day_of_week: 1,
      meal_slot_id: 10,
      baseline,
      dish: '  Pasta  ',
      recipe_id: null,
    });

    await recordMealDiaryPendingEdit(4, {
      week_start_date: WEEK,
      day_of_week: 1,
      meal_slot_id: 10,
      baseline: { dish: 'Pasta', recipe_id: null },
      dish: 'Soup',
      recipe_id: 4,
    });

    const slots = getMealDiaryPendingSlots(4);
    expect(slots).toEqual([
      {
        week_start_date: WEEK,
        day_of_week: 1,
        meal_slot_id: 10,
        baseline,
        dish: 'Soup',
        recipe_id: 4,
      },
    ]);

    const reloaded = await loadMealDiaryPendingQueue(4);
    expect(reloaded).toEqual(slots);
  });

  it('removes the pending slot when the latest value matches the baseline', async () => {
    await recordMealDiaryPendingEdit(4, {
      week_start_date: WEEK,
      day_of_week: 2,
      meal_slot_id: 11,
      baseline: { dish: 'Stew', recipe_id: 8 },
      dish: 'Soup',
      recipe_id: null,
    });

    const removed = await recordMealDiaryPendingEdit(4, {
      week_start_date: WEEK,
      day_of_week: 2,
      meal_slot_id: 11,
      baseline: { dish: 'Soup', recipe_id: null },
      dish: '  Stew  ',
      recipe_id: 8,
    });

    expect(removed).toBeNull();
    expect(getMealDiaryPendingSlots(4)).toEqual([]);
    expect(storage.store.has('meal-diary-pending:4')).toBe(false);
  });

  it('keeps a different slot on the same day', async () => {
    await recordMealDiaryPendingEdit(4, {
      week_start_date: WEEK,
      day_of_week: 1,
      meal_slot_id: 10,
      baseline,
      dish: 'Pasta',
      recipe_id: null,
    });
    await recordMealDiaryPendingEdit(4, {
      week_start_date: WEEK,
      day_of_week: 1,
      meal_slot_id: 12,
      baseline,
      dish: 'Salad',
      recipe_id: 2,
    });

    expect(getMealDiaryPendingSlots(4).map((slot) => slot.meal_slot_id)).toEqual([10, 12]);
  });

  it('drops a queue whose family no longer matches the account', async () => {
    await recordMealDiaryPendingEdit(4, {
      week_start_date: WEEK,
      day_of_week: 1,
      meal_slot_id: 10,
      baseline,
      dish: 'Pasta',
      recipe_id: null,
    });
    await recordMealDiaryPendingEdit(9, {
      week_start_date: WEEK,
      day_of_week: 1,
      meal_slot_id: 10,
      baseline,
      dish: 'Soup',
      recipe_id: null,
    });

    await dropMealDiaryQueuesExcept(4);

    expect(getMealDiaryPendingSlots(4)).toHaveLength(1);
    expect(getMealDiaryPendingSlots(9)).toEqual([]);
    expect(await loadMealDiaryPendingQueue(9)).toEqual([]);
    expect(storage.store.has('meal-diary-pending:9')).toBe(false);
    expect(storage.store.has('meal-diary-pending:4')).toBe(true);
  });
});
