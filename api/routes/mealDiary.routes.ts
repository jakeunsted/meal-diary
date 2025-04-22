import express from 'express';
import * as mealDiaryController from '../controllers/meal-diary/mealDiary.controller.ts';
import * as mealDiaryService from '../services/mealDiary.service.ts';

const router = express.Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     MealDiary:
 *       type: object
 *       required:
 *         - family_group_id
 *         - week_start_date
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the meal diary
 *         family_group_id:
 *           type: integer
 *           description: The id of the family group this meal diary belongs to
 *         week_start_date:
 *           type: string
 *           format: date
 *           description: The start date of the week for this meal diary
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date the meal diary was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date the meal diary was last updated
 *     WeeklyMeals:
 *       type: object
 *       properties:
 *         mealDiary:
 *           $ref: '#/components/schemas/MealDiary'
 *         dailyMeals:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/DailyMeal'
 *     WeeklyMealDay:
 *       type: object
 *       properties:
 *         day_of_week:
 *           type: integer
 *           description: The day of the week (1-7, where 1 is Monday)
 *         breakfast:
 *           type: string
 *           nullable: true
 *         lunch:
 *           type: string
 *           nullable: true
 *         dinner:
 *           type: string
 *           nullable: true
 */

/**
 * @openapi
 * /meal-diaries:
 *   post:
 *     summary: Create a new meal diary
 *     tags: [MealDiaries]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - family_group_id
 *               - week_start_date
 *             properties:
 *               family_group_id:
 *                 type: integer
 *                 description: The id of the family group this meal diary belongs to
 *               week_start_date:
 *                 type: string
 *                 format: date
 *                 description: The start date of the week for this meal diary
 *     responses:
 *       201:
 *         description: The created meal diary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealDiary'
 *       400:
 *         description: Family group ID and week start date are required
 *       500:
 *         description: Failed to create meal diary
 */
router.post('/', async (req, res, next) => {
  try {
    await mealDiaryController.createMealDiary(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /meal-diaries/{family_group_id}:
 *   get:
 *     summary: Get meal diary by family group ID
 *     tags: [MealDiaries]
 *     parameters:
 *       - in: path
 *         name: family_group_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The family group ID
 *     responses:
 *       200:
 *         description: The meal diary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MealDiary'
 *       400:
 *         description: Family group ID is required
 *       500:
 *         description: Failed to get meal diary
 */
router.get('/:family_group_id', async (req, res, next) => {
  try {
    await mealDiaryController.getMealDiaryByFamilyGroupId(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /meal-diaries/{family_group_id}/daily-meals:
 *   get:
 *     summary: Get weekly meals for a family group
 *     tags: [MealDiaries]
 *     parameters:
 *       - in: path
 *         name: family_group_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The family group ID
 *       - in: query
 *         name: week_start_date
 *         schema:
 *           type: string
 *           format: date
 *         required: true
 *         description: The start date of the week
 *     responses:
 *       200:
 *         description: The weekly meals
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   day_of_week:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 7
 *                     description: The day of the week (1-7, where 1 is Monday)
 *                   breakfast:
 *                     type: string
 *                     nullable: true
 *                     description: The breakfast meal
 *                   lunch:
 *                     type: string
 *                     nullable: true
 *                     description: The lunch meal
 *                   dinner:
 *                     type: string
 *                     nullable: true
 *                     description: The dinner meal
 *               example:
 *                 - day_of_week: 1
 *                   breakfast: null
 *                   lunch: null
 *                   dinner: null
 *                 - day_of_week: 2
 *                   breakfast: null
 *                   lunch: null
 *                   dinner: null
 *                 - day_of_week: 3
 *                   breakfast: null
 *                   lunch: null
 *                   dinner: null
 *                 - day_of_week: 4
 *                   breakfast: null
 *                   lunch: null
 *                   dinner: null
 *                 - day_of_week: 5
 *                   breakfast: null
 *                   lunch: null
 *                   dinner: null
 *                 - day_of_week: 6
 *                   breakfast: null
 *                   lunch: null
 *                   dinner: null
 *                 - day_of_week: 7
 *                   breakfast: null
 *                   lunch: null
 *                   dinner: null
 *       400:
 *         description: Family group ID and week start date are required
 *       500:
 *         description: Failed to get weekly meals
 */
router.get('/:family_group_id/daily-meals', async (req, res, next) => {
  try {
    await mealDiaryController.getWeeklyMealsForFamilyGroup(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /meal-diaries/{family_group_id}/daily-meals:
 *   patch:
 *     summary: Update a specific day's meals for a family group
 *     tags: [MealDiaries]
 *     parameters:
 *       - in: path
 *         name: family_group_id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The family group ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - week_start_date
 *               - day_of_week
 *             properties:
 *               week_start_date:
 *                 type: string
 *                 format: date
 *                 description: The start date of the week
 *               day_of_week:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 7
 *                 description: The specific day of the week to update (1-7, where 1 is Monday)
 *               breakfast:
 *                 type: string
 *                 nullable: true
 *                 description: The breakfast meal
 *                 default: ""
 *               lunch:
 *                 type: string
 *                 nullable: true
 *                 description: The lunch meal
 *                 default: ""
 *               dinner:
 *                 type: string
 *                 nullable: true
 *                 description: The dinner meal
 *                 default: ""
 *     responses:
 *       200:
 *         description: The updated daily meal for the specific day
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: integer
 *                   description: The ID of the daily meal
 *                 meal_diary_id:
 *                   type: integer
 *                   description: The ID of the meal diary
 *                 day_of_week:
 *                   type: integer
 *                   description: The day of the week (1-7)
 *                 breakfast:
 *                   type: string
 *                   nullable: true
 *                   description: The breakfast meal
 *                 lunch:
 *                   type: string
 *                   nullable: true
 *                   description: The lunch meal
 *                 dinner:
 *                   type: string
 *                   nullable: true
 *                   description: The dinner meal
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                   description: The date the daily meal was created
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                   description: The date the daily meal was last updated
 *               example:
 *                 id: 42
 *                 meal_diary_id: 15
 *                 day_of_week: 3
 *                 breakfast: "Oatmeal with fruit"
 *                 lunch: "Chicken salad"
 *                 dinner: "Pasta with vegetables"
 *                 created_at: "2023-03-01T12:00:00.000Z"
 *                 updated_at: "2023-03-05T15:30:00.000Z"
 *       400:
 *         description: Family group ID, week start date, and day of week are required
 *       500:
 *         description: Failed to update daily meal
 */
router.patch('/:family_group_id/daily-meals', async (req, res, next) => {
  try {
    await mealDiaryController.updateDailyMealForFamilyGroup(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
