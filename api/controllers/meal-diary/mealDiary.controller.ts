import type { Request, Response } from 'express';
import { MealDiary, DailyMeal } from '../../db/models/associations.ts';
import {
  createNewWeeklyMeals,
  getWeeklyMeals,
  updateDailyMealWithSlots,
} from '../../services/mealDiary.service.ts';
import { RECIPE_NOT_IN_FAMILY_MESSAGE } from '../../services/mealSlots.service.ts';
import { sendDailyMealWebhook } from '../../services/webhook.service.ts';
import * as EntitlementsService from '../../services/entitlements.service.ts';
import { handleEntitlementError } from '../../middleware/entitlement.middleware.ts';
import { trackEvent } from '../../utils/posthog.ts';
import { User } from '../../db/models/associations.ts';
import { routeParamInt } from '../../utils/routeParam.ts';
import {
  MealDiarySyncValidationError,
  parseMealDiaryResolveSlots,
  parseMealDiarySyncSlots,
  resolveMealDiarySync,
  syncMealDiarySlots,
  type MealDiarySyncServiceResult,
} from '../../services/mealDiarySync.service.ts';

// Create a new meal diary
export const createMealDiary = async (req: Request, res: Response) => {
  try {
    const { family_group_id, week_start_date } = req.body;

    // Validate required fields
    if (!family_group_id || !week_start_date) {
      return res.status(400).json({ message: 'Family group ID and week start date are required' });
    }

    if ((req.user as User | undefined)?.dataValues.family_group_id !== parseInt(family_group_id)) {
      return res.status(403).json({ message: 'Access denied' });
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
      where: { family_group_id: routeParamInt(family_group_id) }
    });

    // if no meal diary, create a new one
    if (!mealDiary) {
      // get monday of current week
      const monday = new Date();
      monday.setDate(monday.getDate() - (monday.getDay() || 7) + 1);
      mealDiary = await MealDiary.create({
        family_group_id: routeParamInt(family_group_id),
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

    const familyGroupId = routeParamInt(family_group_id);

    if (user?.dataValues.family_group_id !== familyGroupId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const parsedDate = new Date(week_start_date as string);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid week_start_date format' });
    }

    try {
      await EntitlementsService.assertCanNavigateWeek(
        familyGroupId,
        user.dataValues.id,
        parsedDate
      );
    } catch (error) {
      if (handleEntitlementError(error, res)) {
        return;
      }
      throw error;
    }

    let weeklyMeals = await getWeeklyMeals(
      familyGroupId,
      parsedDate
    );

    // if no weekly meals yet, create the diary and return empty meals
    if (!weeklyMeals) {
      weeklyMeals = await createNewWeeklyMeals(familyGroupId, parsedDate);
    }

    if (user) {
      const mealsWithContent = weeklyMeals.filter(meal => 
        meal.breakfast || meal.lunch || meal.dinner
      ).length;
      
      trackEvent(user.dataValues.id.toString(), 'diary_loaded', {
        family_group_id: familyGroupId,
        week_start_date: week_start_date as string,
        meals_with_content: mealsWithContent,
        total_days: weeklyMeals.length,
      }).catch(err => {
        console.error('Failed to track PostHog event:', err);
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
    const {
      week_start_date,
      day_of_week,
      breakfast,
      lunch,
      dinner,
      breakfast_recipe_id,
      lunch_recipe_id,
      dinner_recipe_id,
      slot_updates,
    } = req.body;
    const user = req.user as User;

    if (!family_group_id || !week_start_date || !day_of_week) {
      return res.status(400).json({
        message: 'Family group ID, week start date, and day of week are required'
      });
    }

    const familyGroupId = routeParamInt(family_group_id);

    if (user?.dataValues.family_group_id !== familyGroupId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const parsedDate = new Date(week_start_date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ message: 'Invalid week_start_date format' });
    }

    const parsedDayOfWeek = parseInt(day_of_week);
    if (parsedDayOfWeek < 1 || parsedDayOfWeek > 7) {
      return res.status(400).json({ message: 'day_of_week must be between 1 and 7' });
    }

    try {
      await EntitlementsService.assertCanUpdateMealWeek(
        familyGroupId,
        user.dataValues.id,
        parsedDate
      );
    } catch (error) {
      if (handleEntitlementError(error, res)) {
        return;
      }
      throw error;
    }

    const legacyUpdates: {
      breakfast?: string;
      lunch?: string;
      dinner?: string;
      breakfast_recipe_id?: number | null;
      lunch_recipe_id?: number | null;
      dinner_recipe_id?: number | null;
    } = {};
    if (breakfast !== undefined) legacyUpdates.breakfast = breakfast;
    if (lunch !== undefined) legacyUpdates.lunch = lunch;
    if (dinner !== undefined) legacyUpdates.dinner = dinner;
    if (breakfast_recipe_id !== undefined) {
      legacyUpdates.breakfast_recipe_id = breakfast_recipe_id;
    }
    if (lunch_recipe_id !== undefined) legacyUpdates.lunch_recipe_id = lunch_recipe_id;
    if (dinner_recipe_id !== undefined) legacyUpdates.dinner_recipe_id = dinner_recipe_id;

    const weekStartDateStr =
      typeof week_start_date === 'string' ? week_start_date : undefined;
    const { meal: updatedMeal, response: responseBody } = await updateDailyMealWithSlots(
      familyGroupId,
      parsedDate,
      parsedDayOfWeek,
      legacyUpdates,
      Array.isArray(slot_updates) ? slot_updates : undefined,
      weekStartDateStr
    );

    sendDailyMealWebhook(
      familyGroupId,
      'update-daily-meal',
      updatedMeal,
      weekStartDateStr
    );

    // Track meal updated
    if (user) {
      const mealTypes: string[] = [];
      if (legacyUpdates.breakfast) mealTypes.push('breakfast');
      if (legacyUpdates.lunch) mealTypes.push('lunch');
      if (legacyUpdates.dinner) mealTypes.push('dinner');
      if (Array.isArray(slot_updates)) {
        for (const update of slot_updates) {
          if (update?.dish) mealTypes.push(`slot_${update.meal_slot_id}`);
        }
      }
      
      await trackEvent(user.dataValues.id.toString(), 'meal_updated', {
        family_group_id: familyGroupId,
        week_start_date: week_start_date as string,
        day_of_week: parsedDayOfWeek,
        meal_types: mealTypes,
      });
    }

    return res.status(200).json(responseBody);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === RECIPE_NOT_IN_FAMILY_MESSAGE) {
      return res.status(400).json({ message });
    }
    if (message === 'Meal diary not found for this week') {
      return res.status(404).json({ message });
    }
    console.error('Error updating daily meal:', error);
    return res.status(500).json({ message: 'Failed to update daily meal' });
  }
};

interface MealDiaryWriteContext {
  familyGroupId: number;
  user: User;
  weekStartDate: Date;
  weekStartDateStr: string;
}

const readMealDiaryWriteContext = (
  req: Request,
  res: Response
): MealDiaryWriteContext | null => {
  const familyGroupParam = req.params.family_group_id;
  const weekStartDate = (req.body ?? {}).week_start_date;

  if (!familyGroupParam || weekStartDate == null || weekStartDate === '') {
    res.status(400).json({
      message: 'Family group ID and week start date are required',
    });
    return null;
  }

  const familyGroupId = routeParamInt(familyGroupParam);
  const user = req.user as User;

  if (user?.dataValues.family_group_id !== familyGroupId) {
    res.status(403).json({ message: 'Access denied' });
    return null;
  }

  if (typeof weekStartDate !== 'string') {
    res.status(400).json({ message: 'Invalid week_start_date format' });
    return null;
  }

  const parsedDate = new Date(weekStartDate);
  if (isNaN(parsedDate.getTime())) {
    res.status(400).json({ message: 'Invalid week_start_date format' });
    return null;
  }

  return {
    familyGroupId,
    user,
    weekStartDate: parsedDate,
    weekStartDateStr: weekStartDate,
  };
};

const publishAppliedDailyMeals = async (
  familyGroupId: number,
  user: User,
  weekStartDateStr: string,
  result: MealDiarySyncServiceResult
): Promise<void> => {
  for (const applied of result.appliedDays) {
    const day = result.dailyMeals.find(
      (meal) => meal.day_of_week === applied.day_of_week
    );
    if (day) {
      sendDailyMealWebhook(
        familyGroupId,
        'update-daily-meal',
        {
          dataValues: {
            day_of_week: day.day_of_week,
            breakfast: day.breakfast,
            lunch: day.lunch,
            dinner: day.dinner,
            breakfast_recipe_id: day.breakfast_recipe_id,
            lunch_recipe_id: day.lunch_recipe_id,
            dinner_recipe_id: day.dinner_recipe_id,
          },
        },
        weekStartDateStr,
        day.slots
      );
    }

    await trackEvent(user.dataValues.id.toString(), 'meal_updated', {
      family_group_id: familyGroupId,
      week_start_date: weekStartDateStr,
      day_of_week: applied.day_of_week,
      meal_types: applied.mealTypes,
    });
  }
};

const handleMealDiarySyncError = (
  error: unknown,
  res: Response,
  logLabel: string,
  fallbackMessage: string
): Response => {
  if (error instanceof MealDiarySyncValidationError) {
    return res.status(400).json({ message: error.message });
  }
  if (handleEntitlementError(error, res)) {
    return res;
  }
  console.error(logLabel, error);
  return res.status(500).json({ message: fallbackMessage });
};

const respondMealDiarySync = async (
  req: Request,
  res: Response,
  run: (context: MealDiaryWriteContext) => Promise<MealDiarySyncServiceResult>,
  logLabel: string,
  fallbackMessage: string
) => {
  try {
    const context = readMealDiaryWriteContext(req, res);
    if (!context) {
      return;
    }

    const result = await run(context);
    await publishAppliedDailyMeals(
      context.familyGroupId,
      context.user,
      context.weekStartDateStr,
      result
    );

    return res.status(200).json({
      dailyMeals: result.dailyMeals,
      results: result.results,
    });
  } catch (error) {
    return handleMealDiarySyncError(error, res, logLabel, fallbackMessage);
  }
};

export const syncDailyMealsForFamilyGroup = (req: Request, res: Response) =>
  respondMealDiarySync(
    req,
    res,
    (context) =>
      syncMealDiarySlots({
        familyGroupId: context.familyGroupId,
        userId: context.user.dataValues.id,
        weekStartDate: context.weekStartDate,
        slots: parseMealDiarySyncSlots((req.body ?? {}).slots),
      }),
    'Error syncing daily meals:',
    'Failed to sync daily meals'
  );

export const resolveDailyMealSyncForFamilyGroup = (req: Request, res: Response) =>
  respondMealDiarySync(
    req,
    res,
    (context) =>
      resolveMealDiarySync({
        familyGroupId: context.familyGroupId,
        userId: context.user.dataValues.id,
        weekStartDate: context.weekStartDate,
        keepMine: parseMealDiaryResolveSlots((req.body ?? {}).keep_mine),
      }),
    'Error resolving daily meal sync:',
    'Failed to resolve daily meal sync'
  );
