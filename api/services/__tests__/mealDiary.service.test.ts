import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { User, FamilyGroup, MealDiary, DailyMeal } from '../../db/models/associations.ts';
import { getWeeklyMeals, updateDailyMeal } from '../mealDiary.service.ts';
import { Op } from 'sequelize';

describe('MealDiary Service', () => {
  let testUser: any;
  let testFamilyGroup: any;
  let testMealDiary: any;

  beforeEach(async () => {
    // Create test user
    testUser = await User.create({
      username: 'vitest_meal_diary_service',
      email: 'vitest_meal_diary_service@example.com',
      password_hash: 'hashedpassword123'
    });

    // Create test family group
    testFamilyGroup = await FamilyGroup.create({
      name: 'Vitest meal diary - Test Family Group',
      created_by: testUser.id,
      random_identifier: 'vitestEleven'
    });

    // Create test meal diary
    testMealDiary = await MealDiary.create({
      family_group_id: testFamilyGroup.id,
      week_start_date: new Date('2024-01-01')
    });
  });

  afterEach(async () => {
    // Clean up test data
    await DailyMeal.destroy({ where: { meal_diary_id: testMealDiary.id } });
    await MealDiary.destroy({ where: { id: testMealDiary.id } });
    await FamilyGroup.destroy({ where: { name: { [Op.like]: 'Vitest meal diary -%' } } });
    await User.destroy({ where: { username: { [Op.like]: 'vitest_meal_diary%' } } });
  });

  describe('getWeeklyMeals', () => {
    it('should return an array of 7 days with null meals when no meals exist', async () => {
      const weeklyMeals = await getWeeklyMeals(
        testFamilyGroup.id,
        new Date('2024-01-01')
      );

      expect(weeklyMeals).toHaveLength(7);
      weeklyMeals.forEach((meal, index) => {
        expect(meal.day_of_week).toBe(index + 1);
        expect(meal.breakfast).toBeNull();
        expect(meal.lunch).toBeNull();
        expect(meal.dinner).toBeNull();
      });
    });

    it('should return existing meals when they exist', async () => {
      // Create some test daily meals
      await DailyMeal.create({
        meal_diary_id: testMealDiary.id,
        day_of_week: 1,
        breakfast: 'Oatmeal',
        lunch: 'Sandwich',
        dinner: 'Pizza'
      });

      await DailyMeal.create({
        meal_diary_id: testMealDiary.id,
        day_of_week: 3,
        breakfast: 'Eggs',
        lunch: 'Salad',
        dinner: 'Pasta'
      });

      const weeklyMeals = await getWeeklyMeals(
        testFamilyGroup.id,
        new Date('2024-01-01')
      );

      expect(weeklyMeals).toHaveLength(7);
      
      // Check day 1
      expect(weeklyMeals[0].day_of_week).toBe(1);
      expect(weeklyMeals[0].breakfast).toBe('Oatmeal');
      expect(weeklyMeals[0].lunch).toBe('Sandwich');
      expect(weeklyMeals[0].dinner).toBe('Pizza');

      // Check day 2 (should be null)
      expect(weeklyMeals[1].day_of_week).toBe(2);
      expect(weeklyMeals[1].breakfast).toBeNull();
      expect(weeklyMeals[1].lunch).toBeNull();
      expect(weeklyMeals[1].dinner).toBeNull();

      // Check day 3
      expect(weeklyMeals[2].day_of_week).toBe(3);
      expect(weeklyMeals[2].breakfast).toBe('Eggs');
      expect(weeklyMeals[2].lunch).toBe('Salad');
      expect(weeklyMeals[2].dinner).toBe('Pasta');
    });

    it('should create a new meal diary if it does not exist', async () => {
      const newWeekStartDate = new Date('2024-01-08');
      const weeklyMeals = await getWeeklyMeals(
        testFamilyGroup.id,
        newWeekStartDate
      );

      // Verify a new meal diary was created
      const newMealDiary = await MealDiary.findOne({
        where: {
          family_group_id: testFamilyGroup.id,
          week_start_date: newWeekStartDate
        }
      });

      expect(newMealDiary).toBeTruthy();
      expect(weeklyMeals).toHaveLength(7);
    });
  });

  describe('updateDailyMeal', () => {
    it('should create a new daily meal if it does not exist', async () => {
      const updatedMeal = await updateDailyMeal(
        testFamilyGroup.id,
        new Date('2024-01-01'),
        1,
        {
          breakfast: 'New Breakfast',
          lunch: 'New Lunch',
          dinner: 'New Dinner'
        }
      );

      expect(updatedMeal.dataValues.day_of_week).toBe(1);
      expect(updatedMeal.dataValues.breakfast).toBe('New Breakfast');
      expect(updatedMeal.dataValues.lunch).toBe('New Lunch');
      expect(updatedMeal.dataValues.dinner).toBe('New Dinner');
    });

    it('should update an existing daily meal', async () => {
      // Create an initial daily meal
      await DailyMeal.create({
        meal_diary_id: testMealDiary.id,
        day_of_week: 1,
        breakfast: 'Old Breakfast',
        lunch: 'Old Lunch',
        dinner: 'Old Dinner'
      });

      // Update only breakfast
      const updatedMeal = await updateDailyMeal(
        testFamilyGroup.id,
        new Date('2024-01-01'),
        1,
        {
          breakfast: 'New Breakfast'
        }
      );

      expect(updatedMeal.dataValues.day_of_week).toBe(1);
      expect(updatedMeal.dataValues.breakfast).toBe('New Breakfast');
      expect(updatedMeal.dataValues.lunch).toBe('Old Lunch');
      expect(updatedMeal.dataValues.dinner).toBe('Old Dinner');
    });

    it('should throw an error if meal diary does not exist', async () => {
      const futureDate = new Date('2025-01-01');
      
      await expect(
        updateDailyMeal(
          testFamilyGroup.id,
          futureDate,
          1,
          {
            breakfast: 'New Breakfast'
          }
        )
      ).rejects.toThrow('Meal diary not found for this week');
    });

    it('should handle null values for meals', async () => {
      const updatedMeal = await updateDailyMeal(
        testFamilyGroup.id,
        new Date('2024-01-01'),
        1,
        {
          breakfast: '',
          lunch: '',
          dinner: ''
        }
      );

      expect(updatedMeal.dataValues.day_of_week).toBe(1);
      expect(updatedMeal.dataValues.breakfast).toBe('');
      expect(updatedMeal.dataValues.lunch).toBe('');
      expect(updatedMeal.dataValues.dinner).toBe('');
    });
  });
});