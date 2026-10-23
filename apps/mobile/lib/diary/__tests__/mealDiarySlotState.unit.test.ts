import { describe, expect, it } from 'vitest';

import {
  applyLocalSlotValue,
  mergeRealtimeDailyMeal,
  overlayPendingSlots,
  restoreSkippedSlots,
} from '@/lib/diary/mealDiarySlotState';
import type { MealDiaryPendingSlot } from '@/lib/diary/mealDiaryPendingQueue';
import type { DailyMeal, DayMealSlot } from '@/types/mealDiary';

const WEEK = '2026-10-19';

const slot = (dish: string | null, mealSlotId = 10): DayMealSlot => ({
  id: mealSlotId,
  meal_slot_id: mealSlotId,
  name: 'Breakfast',
  position: 0,
  dish,
  recipe_id: null,
  legacy_key: 'breakfast',
});

const day = (dish: string | null, dayOfWeek = 1): DailyMeal => ({
  day_of_week: dayOfWeek,
  week_start_date: WEEK,
  breakfast: dish,
  lunch: null,
  dinner: null,
  breakfast_recipe_id: null,
  lunch_recipe_id: null,
  dinner_recipe_id: null,
  slots: [slot(dish)],
});

const pending = (dish: string): MealDiaryPendingSlot => ({
  week_start_date: WEEK,
  day_of_week: 1,
  meal_slot_id: 10,
  baseline: { dish: 'Toast', recipe_id: null },
  dish,
  recipe_id: null,
});

describe('meal diary slot state', () => {
  it('overlays pending dishes for the matching week and day', () => {
    const next = overlayPendingSlots([day('Toast')], WEEK, [
      pending('Eggs'),
      { ...pending('Soup'), week_start_date: '2026-10-26' },
    ]);

    expect(next[0].slots?.[0].dish).toBe('Eggs');
    expect(next[0].breakfast).toBe('Eggs');
  });

  it('applies a local value onto the legacy column', () => {
    const next = applyLocalSlotValue([day('Toast')], WEEK, 1, 10, 'breakfast', 'Eggs', 4);

    expect(next[0].slots?.[0]).toMatchObject({ dish: 'Eggs', recipe_id: 4 });
    expect(next[0].breakfast).toBe('Eggs');
    expect(next[0].breakfast_recipe_id).toBe(4);
  });

  it('restores a skipped slot from the server and keeps remaining pending edits', () => {
    const current = [day('Eggs')];
    const server = [day('Toast')];
    const next = restoreSkippedSlots(current, server, WEEK, [{ day_of_week: 1, meal_slot_id: 10 }], [
      { ...pending('Porridge'), meal_slot_id: 11, day_of_week: 2 },
    ]);

    expect(next[0].slots?.[0].dish).toBe('Toast');
    expect(next[0].breakfast).toBe('Toast');
  });

  it('keeps a pending dish when a realtime meal arrives', () => {
    const merged = mergeRealtimeDailyMeal(
      day('Eggs'),
      { ...day('Server'), slots: [slot('Server')] },
      [pending('Eggs')],
      WEEK
    );

    expect(merged.slots?.[0].dish).toBe('Eggs');
    expect(merged.breakfast).toBe('Eggs');
  });
});
