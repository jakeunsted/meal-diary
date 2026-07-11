import type { DailyMeal, MealType, SaveDailyMealPayload } from '@/types/mealDiary';

export function buildSaveDailyMealPayload(
  weeklyMeals: DailyMeal[],
  weekKey: string,
  dayOfWeek: number,
  mealType: MealType,
  mealName: string,
  recipeId: number | null
): SaveDailyMealPayload {
  const dayMeal = weeklyMeals.find((meal) => meal.day_of_week === dayOfWeek);

  const payload: SaveDailyMealPayload = {
    week_start_date: weekKey,
    day_of_week: dayOfWeek,
    breakfast: dayMeal?.breakfast || '',
    lunch: dayMeal?.lunch || '',
    dinner: dayMeal?.dinner || '',
    breakfast_recipe_id: dayMeal?.breakfast_recipe_id ?? null,
    lunch_recipe_id: dayMeal?.lunch_recipe_id ?? null,
    dinner_recipe_id: dayMeal?.dinner_recipe_id ?? null,
  };

  payload[mealType] = mealName.trim();
  payload[`${mealType}_recipe_id`] = recipeId;

  return payload;
}
