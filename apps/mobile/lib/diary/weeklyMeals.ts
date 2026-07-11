import type { DailyMeal } from '@/types/mealDiary';

export function buildWeekDayMeals(weeklyMeals: DailyMeal[], weekKey: string): DailyMeal[] {
  const byDay = new Map(weeklyMeals.map((meal) => [meal.day_of_week, meal]));

  return Array.from({ length: 7 }, (_, index) => {
    const dayOfWeek = index + 1;
    const existing = byDay.get(dayOfWeek);

    if (existing) {
      return { ...existing, week_start_date: weekKey };
    }

    return {
      day_of_week: dayOfWeek,
      breakfast: null,
      lunch: null,
      dinner: null,
      breakfast_recipe_id: null,
      lunch_recipe_id: null,
      dinner_recipe_id: null,
      week_start_date: weekKey,
    };
  });
}

export function toMealSlot(
  name: string | null,
  recipeId: number | null
): { name: string; recipeId: number | null } | undefined {
  if (!name) {
    return undefined;
  }
  return { name, recipeId };
}
