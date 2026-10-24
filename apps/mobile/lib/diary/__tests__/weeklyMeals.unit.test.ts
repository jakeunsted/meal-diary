import { describe, expect, it } from 'vitest';

import { buildSaveDailyMealPayload } from '@/lib/diary/buildSaveDailyMealPayload';
import { buildWeekDayMeals, toMealSlot } from '@/lib/diary/weeklyMeals';
import type { DailyMeal } from '@/types/mealDiary';

const day = (dayOfWeek: number, breakfast: string | null): DailyMeal => ({
  day_of_week: dayOfWeek,
  week_start_date: '2026-10-12',
  breakfast,
  lunch: null,
  dinner: null,
  breakfast_recipe_id: breakfast ? 4 : null,
  lunch_recipe_id: null,
  dinner_recipe_id: null,
});

describe('weekly meals', () => {
  it('fills a seven-day week and keeps meals that already exist', () => {
    const days = buildWeekDayMeals([day(3, 'Soup')], '2026-10-19');

    expect(days).toHaveLength(7);
    expect(days[2]).toMatchObject({ day_of_week: 3, breakfast: 'Soup', week_start_date: '2026-10-19' });
    expect(days[0]).toMatchObject({ day_of_week: 1, breakfast: null, week_start_date: '2026-10-19' });
  });

  it('omits an empty meal slot', () => {
    expect(toMealSlot(null, 4)).toBeUndefined();
    expect(toMealSlot('Soup', 4)).toEqual({ name: 'Soup', recipeId: 4 });
  });
});

describe('buildSaveDailyMealPayload', () => {
  it('copies the day and overlays the edited meal and slot', () => {
    const payload = buildSaveDailyMealPayload(
      [day(1, 'Toast')],
      '2026-10-19',
      1,
      'breakfast',
      '  Eggs  ',
      8,
      10
    );

    expect(payload).toEqual({
      week_start_date: '2026-10-19',
      day_of_week: 1,
      breakfast: 'Eggs',
      lunch: '',
      dinner: '',
      breakfast_recipe_id: 8,
      lunch_recipe_id: null,
      dinner_recipe_id: null,
      slot_updates: [{ meal_slot_id: 10, dish: 'Eggs', recipe_id: 8 }],
    });
  });
});
