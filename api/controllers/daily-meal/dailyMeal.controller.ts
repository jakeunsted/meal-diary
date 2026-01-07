import type { Request, Response } from 'express';
import { DailyMeal, User } from '../../db/models/associations.ts';
import { Op } from 'sequelize';
import { trackEvent, getDistinctId } from '../../utils/posthog.ts';

// Create a new daily meal
export const createDailyMeal = async (req: Request, res: Response) => {
  try {
    const { meal_diary_id, day_of_week, breakfast, lunch, dinner } = req.body;

    // Validate required fields
    if (!meal_diary_id || !day_of_week) {
      return res.status(400).json({ message: 'Meal diary ID and day of week are required' });
    }

    // Create the daily meal
    const dailyMeal = await DailyMeal.create({
      meal_diary_id,
      day_of_week,
      breakfast,
      lunch,
      dinner
    });

    // Track daily meal created
    const user = req.user as User;
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

    return res.status(201).json(dailyMeal);
  } catch (error) {
    console.error('Error creating daily meal:', error);
    return res.status(500).json({ message: 'Failed to create daily meal' });
  }
};

// get all daily meals by meal diary id
export const getDailyMealsByMealDiaryId = async (req: Request, res: Response) => {
  try {
    const { meal_diary_id } = req.params;

    // Validate meal diary ID
    if (!meal_diary_id) {
      return res.status(400).json({ message: 'Meal diary ID is required' });
    }

    // Find daily meals by meal diary ID
    const dailyMeals = await DailyMeal.findAll({
      where: { meal_diary_id: parseInt(meal_diary_id) }
    });

    return res.status(200).json(dailyMeals);
  } catch (error) {
    console.error('Error getting daily meals:', error);
    return res.status(500).json({ message: 'Failed to get daily meals' });
  }
};

// update a daily meal by id
export const updateDailyMealById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { breakfast = null, lunch = null, dinner = null } = req.body;

    const dailyMeal = await DailyMeal.findByPk(id);

    if (!dailyMeal) {
      return res.status(404).json({ message: 'Daily meal not found' });
    }

    dailyMeal.dataValues.breakfast = breakfast;
    dailyMeal.dataValues.lunch = lunch;
    dailyMeal.dataValues.dinner = dinner;

    await dailyMeal.save();

    // Track daily meal updated
    const user = req.user as User;
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

    return res.status(200).json(dailyMeal);
  } catch (error) {
    console.error('Error updating daily meal:', error);
    return res.status(500).json({ message: 'Failed to update daily meal' });
  }
};
