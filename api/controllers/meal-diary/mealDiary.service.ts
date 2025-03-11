import { MealDiary, DailyMeal } from '../../db/models/associations.ts';
import { Op } from 'sequelize';

interface DailyMealWithDay {
  day_of_week: number;
  breakfast: string | null;
  lunch: string | null;
  dinner: string | null;
}

export const createNewWeeklyMeals = async (familyGroupId: number, weekStartDate: Date): Promise<DailyMealWithDay[]> => {
  // Create an array of 7 days starting from weekStartDate
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStartDate);
    date.setDate(date.getDate() + index);
    return {
      date: date,
      breakfast: '',
      lunch: '',
      dinner: '',
    };
  });

  const mealDiary = await MealDiary.create({
    family_group_id: familyGroupId,
    week_start_date: weekStartDate
  });

  for (const day of days) {
    await DailyMeal.create({
      meal_diary_id: mealDiary.dataValues.id,
      day_of_week: day.date.getDay(),
      breakfast: day.breakfast || '',
      lunch: day.lunch || '',
      dinner: day.dinner || ''
    });
  }

  const weeklyMeals: DailyMealWithDay[] = [];
  for (let day = 1; day <= 7; day++) {
    weeklyMeals.push({
      day_of_week: day,
      breakfast: '',
      lunch: '',
      dinner: ''
    });
  }

  return weeklyMeals;
};

/**
 * Get the meal diary for given family group id with the daily meals for that week
 */

export const getWeeklyMeals = async (familyGroupId: number, weekStartDate: Date): Promise<DailyMealWithDay[]> => {
  // First, find or create the meal diary for this week
  let mealDiary = await MealDiary.findOne({
    where: {
      family_group_id: familyGroupId,
      week_start_date: weekStartDate
    }
  });

  if (!mealDiary) {
    // Create a new meal diary if it doesn't exist
    mealDiary = await MealDiary.create({
      family_group_id: familyGroupId,
      week_start_date: weekStartDate
    });
  }

  // Get all daily meals for this week
  const dailyMeals = await DailyMeal.findAll({
    where: { meal_diary_id: mealDiary.dataValues.id },
    order: [['day_of_week', 'ASC']]
  });
  
  // Create a map of existing daily meals
  const existingMealsMap = new Map(
    dailyMeals.map(meal => [meal.dataValues.day_of_week, meal])
  );

  // Create an array of all 7 days, with existing meals or null values
  const weeklyMeals: DailyMealWithDay[] = [];
  for (let day = 1; day <= 7; day++) {
    const existingMeal = existingMealsMap.get(day);
    weeklyMeals.push({
      day_of_week: day,
      breakfast: existingMeal?.dataValues.breakfast || null,
      lunch: existingMeal?.dataValues.lunch || null,
      dinner: existingMeal?.dataValues.dinner || null
    });
  }

  return weeklyMeals;
};

export const updateDailyMeal = async (
  familyGroupId: number,
  weekStartDate: Date,
  dayOfWeek: number,
  updates: {
    breakfast?: string;
    lunch?: string;
    dinner?: string;
  }
): Promise<DailyMeal> => {
  // Find the meal diary for this week
  const mealDiary = await MealDiary.findOne({
    where: {
      family_group_id: familyGroupId,
      week_start_date: weekStartDate
    }
  });

  if (!mealDiary) {
    throw new Error('Meal diary not found for this week');
  }

  // Find or create the daily meal
  let dailyMeal = await DailyMeal.findOne({
    where: {
      meal_diary_id: mealDiary.dataValues.id,
      day_of_week: dayOfWeek
    }
  });

  if (!dailyMeal) {
    // Create a new daily meal if it doesn't exist
    dailyMeal = await DailyMeal.create({
      meal_diary_id: mealDiary.dataValues.id,
      day_of_week: dayOfWeek
    });
  }

  // Update the daily meal
  await dailyMeal.update(updates);

  return dailyMeal;
};