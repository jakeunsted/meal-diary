import DailyMeal from "../db/models/DailyMeal.model";
import { User } from "../db/models/associations.ts";
import { trackEvent } from "../utils/posthog.ts";

export const createDailyMealEntry = async (
  meal_diary_id: number,
  day_of_week: number,
  breakfast: string,
  lunch: string,
  dinner: string,
  user: User
): Promise<DailyMeal> => {
  // Create the daily meal
  const dailyMeal = await DailyMeal.create({
    meal_diary_id,
    day_of_week,
    breakfast,
    lunch,
    dinner
  });

  // Track daily meal created
  if (user) {
    const mealTypes: string[] = [];
    if (breakfast) mealTypes.push('breakfast');
    if (lunch) mealTypes.push('lunch');
    if (dinner) mealTypes.push('dinner');
    
    await trackEvent(user.dataValues.id.toString(), 'daily_meal_created', {
      meal_diary_id,
      day_of_week,
      meal_types: mealTypes,
    });
  }

  return dailyMeal;
}

export const updateDailyMealById = async (
  id: number, 
  breakfast: string, 
  lunch: string, 
  dinner: string, 
  user: User
): Promise<DailyMeal> => {
  const dailyMeal = await DailyMeal.findByPk(id);

  if (!dailyMeal) {
    throw new Error('Daily meal not found');
  }
  dailyMeal.dataValues.breakfast = breakfast;
  dailyMeal.dataValues.lunch = lunch;
  dailyMeal.dataValues.dinner = dinner;
  await dailyMeal.save();

  // Track daily meal updated
  if (user) {
    const mealTypes: string[] = [];
    if (breakfast) mealTypes.push('breakfast');
    if (lunch) mealTypes.push('lunch');
    if (dinner) mealTypes.push('dinner');
    
    await trackEvent(user.dataValues.id.toString(), 'daily_meal_updated', {
      daily_meal_id: id,
      day_of_week: dailyMeal.dataValues.day_of_week,
      meal_types: mealTypes,
    });
  }

  return dailyMeal;
}

export const getDailyMealsByMealDiaryId = async (meal_diary_id: number): Promise<DailyMeal[]> => {
  const dailyMeals = await DailyMeal.findAll({
    where: { meal_diary_id }
  });
  return dailyMeals;
}