import type { Request, Response } from 'express';
import { MealDiary, DailyMeal } from '../../db/models/associations.ts';
import { createNewWeeklyMeals, getWeeklyMeals, updateDailyMeal } from '../../services/mealDiary.service.ts';
import { sendDailyMealWebhook } from '../../services/webhook.service.ts';
import { trackEvent } from '../../utils/posthog.ts';
import { User } from '../../db/models/associations.ts';

// Create a new meal diary
export const createMealDiary = async (req: Request, res: Response) => {
  try {
    const { family_group_id, week_start_date } = req.body;

    // Validate required fields
    if (!family_group_id || !week_start_date) {
      return res.status(400).json({ message: 'Family group ID and week start date are required' });
    }

    // Create the meal diary
    const mealDiary = await MealDiary.create({
      family_group_id,
      week_start_date,
    });

    return res.status(201).json(mealDiary);
  } catch (error) {
    console.error('Error creating meal diary:', error);
    return res.status(500).json({ message: 'Failed to create meal diary' });
  }
};

// Get meal diary by family group ID
export const getMealDiaryByFamilyGroupId = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;

    // Validate family group ID
    if (!family_group_id) {
      return res.status(400).json({ message: 'Family group ID is required' });
    }

    // Find meal diary by family group ID
    let mealDiary = await MealDiary.findOne({
      where: { family_group_id: parseInt(family_group_id) }
    });

    // if no meal diary, create a new one
    if (!mealDiary) {
      // get monday of current week
      const monday = new Date();
      monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1);
      mealDiary = await MealDiary.create({
        family_group_id: parseInt(family_group_id),
        week_start_date: monday
      });
    }

    return res.status(200).json(mealDiary);
  } catch (error) {
    console.error('Error getting meal diary:', error);
    return res.status(500).json({ message: 'Failed to get meal diary' });
  }
};

// Get weekly meals for a family group
export const getWeeklyMealsForFamilyGroup = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { week_start_date } = req.query;
    const user = req.user as User;

    if (!family_group_id || !week_start_date) {
      return res.status(400).json({ message: 'Family group ID and week start date are required' });
    }

    let weeklyMeals = await getWeeklyMeals(
      parseInt(family_group_id),
      new Date(week_start_date as string)
    );

    // if no weekly meals yet, create the diary and return empty meals
    if (!weeklyMeals) {
      weeklyMeals = await createNewWeeklyMeals(
        parseInt(family_group_id),
        new Date(week_start_date as string)
      );
    }

    if (user) {
      const mealsWithContent = weeklyMeals.filter(meal => 
        meal.breakfast || meal.lunch || meal.dinner
      ).length;
      
      trackEvent(user.dataValues.id.toString(), 'diary_loaded', {
        family_group_id: parseInt(family_group_id),
        week_start_date: week_start_date as string,
        meals_with_content: mealsWithContent,
        total_days: weeklyMeals.length,
      }).catch(() => {
        // Silently fail
      });
    }

    return res.status(200).json(weeklyMeals);
  } catch (error) {
    console.error('Error getting weekly meals:', error);
    return res.status(500).json({ message: 'Failed to get weekly meals' });
  }
};

// Update a daily meal
export const updateDailyMealForFamilyGroup = async (req: Request, res: Response) => {
  try {
    const { family_group_id } = req.params;
    const { week_start_date, day_of_week, breakfast = '', lunch = '', dinner = '' } = req.body;

    if (!family_group_id || !week_start_date || !day_of_week) {
      return res.status(400).json({ 
        message: 'Family group ID, week start date, and day of week are required' 
      });
    }

    const updatedMeal= await updateDailyMeal(
      parseInt(family_group_id),
      new Date(week_start_date),
      parseInt(day_of_week),
      { breakfast, lunch, dinner }
    );

    sendDailyMealWebhook(
      parseInt(family_group_id),
      'update-daily-meal',
      updatedMeal.dataValues as unknown as DailyMeal
    );

    // Track meal updated
    const user = req.user as User;
    if (user) {
      const mealTypes: string[] = [];
      if (breakfast) mealTypes.push('breakfast');
      if (lunch) mealTypes.push('lunch');
      if (dinner) mealTypes.push('dinner');
      
      await trackEvent(user.dataValues.id.toString(), 'meal_updated', {
        family_group_id: parseInt(family_group_id),
        week_start_date: week_start_date as string,
        day_of_week: parseInt(day_of_week),
        meal_types: mealTypes,
      });
    }

    return res.status(200).json(updatedMeal);
  } catch (error) {
    console.error('Error updating daily meal:', error);
    return res.status(500).json({ message: 'Failed to update daily meal' });
  }
};
