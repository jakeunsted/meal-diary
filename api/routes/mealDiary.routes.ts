import express from 'express';
import * as mealDiaryController from '../controllers/meal-diary/mealDiary.controller.ts';
import * as mealDiaryService from '../controllers/meal-diary/mealDiary.service.ts';

const router = express.Router();

// Create a new meal diary
router.post('/', async (req, res, next) => {
  try {
    await mealDiaryController.createMealDiary(req, res);
  } catch (error) {
    next(error);
  }
});

// Get meal diary by family group ID
router.get('/:family_group_id', async (req, res, next) => {
  try {
    await mealDiaryController.getMealDiaryByFamilyGroupId(req, res);
  } catch (error) {
    next(error);
  }
});

// probably needs to get, or set and get if not there
// Get meal diary with the daily meals for family group
router.get('/:family_group_id/daily-meals', async (req, res, next) => {
  try {
    await mealDiaryController.getWeeklyMealsForFamilyGroup(req, res);
  } catch (error) {
    next(error);
  }
});

// Update a daily meal for a family group
router.patch('/:family_group_id/daily-meals', async (req, res, next) => {
  try {
    await mealDiaryController.updateDailyMealForFamilyGroup(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
