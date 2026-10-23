import { describe, expect, it } from 'vitest';
import type { DailyMeal, MealDiaryPendingSlot } from '~/types/MealDiary';
import {
  applyLegacyColumnsFromSlots,
  cloneServerWeek,
  isMealDiaryPendingSlot,
  readSlotValue,
  restorePendingLegacyColumns,
  writeSlotValue,
} from './mealDiarySync';

const day = (): DailyMeal => ({
  day_of_week: 1,
  week_start_date: '2026-10-19',
  breakfast: 'Old breakfast',
  lunch: null,
  dinner: null,
  breakfast_recipe_id: 1,
  lunch_recipe_id: null,
  dinner_recipe_id: null,
  slots: [
    {
      id: 1,
      meal_slot_id: 10,
      name: 'Breakfast',
      position: 0,
      dish: 'Porridge',
      recipe_id: 4,
      legacy_key: 'breakfast',
    },
    {
      id: 2,
      meal_slot_id: 11,
      name: 'Snack',
      position: 1,
      dish: 'Apple',
      recipe_id: null,
      legacy_key: null,
    },
  ],
});

const pending = (): MealDiaryPendingSlot => ({
  family_group_id: 3,
  week_start_date: '2026-10-19',
  day_of_week: 1,
  meal_slot_id: 10,
  baseline: { dish: 'Porridge', recipe_id: 4 },
  dish: 'Eggs',
  recipe_id: null,
});

describe('meal diary sync helpers', () => {
  it('accepts a pending slot and rejects incomplete values', () => {
    expect(isMealDiaryPendingSlot(pending())).toBe(true);
    expect(isMealDiaryPendingSlot({ ...pending(), baseline: null })).toBe(false);
    expect(isMealDiaryPendingSlot(null)).toBe(false);
  });

  it('copies legacy breakfast, lunch, and dinner columns from slots', () => {
    const source = day();
    const next = applyLegacyColumnsFromSlots(source);

    expect(next.breakfast).toBe('Porridge');
    expect(next.breakfast_recipe_id).toBe(4);
    expect(next.lunch).toBeNull();
  });

  it('reads and writes a slot, including the legacy column', () => {
    const source = day();

    expect(readSlotValue(source, 10, 'breakfast')).toEqual({ dish: 'Porridge', recipe_id: 4 });
    writeSlotValue(source, 10, { dish: 'Eggs', recipe_id: null });

    expect(source.slots?.[0].dish).toBe('Eggs');
    expect(source.breakfast).toBe('Eggs');
    expect(source.breakfast_recipe_id).toBeNull();
    expect(readSlotValue(undefined, 10, null)).toEqual({ dish: null, recipe_id: null });
  });

  it('clones a server week without sharing slot objects', () => {
    const source = day();
    const cloned = cloneServerWeek('2026-10-26', [source]);

    cloned[0].slots![0].dish = 'Changed';
    expect(source.slots?.[0].dish).toBe('Porridge');
    expect(cloned[0].week_start_date).toBe('2026-10-26');
  });

  it('restores legacy columns only for pending slots', () => {
    const source = day();
    source.slots![0].dish = 'Eggs';
    const next = restorePendingLegacyColumns(source, (mealSlotId) => mealSlotId === 10);

    expect(next.breakfast).toBe('Eggs');
    expect(next.lunch).toBeNull();
  });
});
