import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MealDiaryPendingSlot } from '@/lib/diary/mealDiaryPendingQueue';
import type { DailyMeal } from '@/types/mealDiary';
import type { ShoppingList, ShoppingListItem } from '@/types/shoppingList';

const realtime = vi.hoisted(() => ({
  hasPendingOps: false,
  pendingSlots: [] as MealDiaryPendingSlot[],
  lists: new Map<number, ShoppingList | undefined>(),
}));

vi.mock('@/lib/shopping-list/shoppingListPendingQueue', () => ({
  hasPendingOps: () => realtime.hasPendingOps,
}));

vi.mock('@/lib/queries/shoppingList', () => ({
  setShoppingListQueryData: (
    _queryClient: unknown,
    familyGroupId: number,
    updater: (shoppingList: ShoppingList | undefined) => ShoppingList | undefined
  ) => {
    realtime.lists.set(familyGroupId, updater(realtime.lists.get(familyGroupId)));
  },
}));

vi.mock('@/lib/diary/mealDiaryPendingQueue', () => ({
  getMealDiaryPendingSlots: () => realtime.pendingSlots,
}));

vi.mock('@/lib/diary/mealDiaryStorage', () => ({
  saveWeeklyMealsCache: vi.fn(),
}));

vi.mock('@/lib/queries/mealDiary', () => ({
  mealDiaryKeys: {
    all: ['mealDiary'] as const,
    weekly: (familyGroupId: number, weekKey: string) =>
      ['mealDiary', familyGroupId, weekKey] as const,
  },
}));

import { applyFamilyRealtimeEvent } from '@/lib/realtime/applyFamilyRealtimeEvent';

const WEEK = '2026-10-19';

const item = (id: number, name: string): ShoppingListItem => ({
  id,
  shopping_list_id: 1,
  name,
  checked: false,
  deleted: false,
  created_by: 4,
  category: 'dairy',
  position: 0,
  created_at: '',
  updated_at: '',
});

const list = (items: ShoppingListItem[]): ShoppingList => ({
  id: 1,
  family_group_id: 9,
  created_at: '',
  updated_at: '',
  items,
});

const day = (dish: string): DailyMeal => ({
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
      id: 10,
      meal_slot_id: 10,
      name: 'Breakfast',
      position: 0,
      dish,
      recipe_id: null,
      legacy_key: 'breakfast',
    },
  ],
});

function queryClientWith(meals: DailyMeal[] | undefined) {
  const stored = new Map<string, unknown>();
  const key = JSON.stringify(['mealDiary', 9, WEEK]);
  if (meals) {
    stored.set(key, meals);
  }
  return {
    getQueryData: (queryKey: readonly unknown[]) => stored.get(JSON.stringify(queryKey)),
    setQueryData: (queryKey: readonly unknown[], updater: (current: DailyMeal[] | undefined) => DailyMeal[] | undefined) => {
      const next = updater(stored.get(JSON.stringify(queryKey)) as DailyMeal[] | undefined);
      stored.set(JSON.stringify(queryKey), next);
      return next;
    },
    invalidateQueries: vi.fn(),
  };
}

describe('applyFamilyRealtimeEvent', () => {
  beforeEach(() => {
    realtime.hasPendingOps = false;
    realtime.pendingSlots = [];
    realtime.lists.clear();
  });

  it('ignores shopping-list events from the current user and while pending ops exist', () => {
    realtime.lists.set(9, list([item(1, 'Milk')]));

    applyFamilyRealtimeEvent(
      {} as never,
      9,
      'add-item',
      { item: item(2, 'Yogurt'), actorUserId: 3 },
      3
    );
    expect(realtime.lists.get(9)?.items.map((entry) => entry.id)).toEqual([1]);

    realtime.hasPendingOps = true;
    applyFamilyRealtimeEvent(
      {} as never,
      9,
      'delete-item',
      { item: item(1, 'Milk'), actorUserId: 8 },
      3
    );
    expect(realtime.lists.get(9)?.items).toHaveLength(1);
  });

  it('adds, updates, and deletes shopping-list items from someone else', () => {
    realtime.lists.set(9, list([item(1, 'Milk')]));

    applyFamilyRealtimeEvent({} as never, 9, 'add-item', { item: item(2, 'Yogurt'), actorUserId: 8 }, 3);
    applyFamilyRealtimeEvent(
      {} as never,
      9,
      'check-item',
      { item: { ...item(1, 'Milk'), checked: true }, actorUserId: 8 },
      3
    );
    applyFamilyRealtimeEvent({} as never, 9, 'delete-item', { item: item(2, 'Yogurt'), actorUserId: 8 }, 3);

    expect(realtime.lists.get(9)?.items).toEqual([
      expect.objectContaining({ id: 1, checked: true }),
    ]);
  });

  it('merges a diary event without clobbering a pending slot', () => {
    realtime.pendingSlots = [
      {
        week_start_date: WEEK,
        day_of_week: 1,
        meal_slot_id: 10,
        baseline: { dish: 'Toast', recipe_id: null },
        dish: 'Eggs',
        recipe_id: null,
      },
    ];
    const client = queryClientWith([day('Eggs')]);

    applyFamilyRealtimeEvent(
      client as never,
      9,
      'update-daily-meal',
      { dailyMeal: day('Server') },
      3
    );

    const meals = client.getQueryData(['mealDiary', 9, WEEK]) as DailyMeal[];
    expect(meals[0].slots?.[0].dish).toBe('Eggs');
    expect(meals[0].breakfast).toBe('Eggs');
  });
});
