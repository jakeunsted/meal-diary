import { describe, it, expect } from 'vitest';
import { FamilyGroup, MealDiary, DailyMeal, User } from '../../db.ts';
import { ValidationError } from 'sequelize';

describe('DailyMeal Model', () => {
  it('should create a new daily meal successfully', async () => {
    // Create a test user first
    const user = await User.create({
      username: 'vitest_test_daily_meal',
      email: 'vitest_test_daily_meal@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();
    expect(userJson.id).toBeDefined();

    // Create a family group
    const familyGroup = await FamilyGroup.create({
      name: 'Vitest - Daily Meal Test',
      created_by: userJson.id
    });
    const familyGroupJson = familyGroup.toJSON();
    expect(familyGroupJson.id).toBeDefined();

    // Create a meal diary
    const mealDiary = await MealDiary.create({
      family_group_id: familyGroupJson.id,
      week_start_date: new Date('2024-01-01')
    });
    const mealDiaryJson = mealDiary.toJSON();
    expect(mealDiaryJson.id).toBeDefined();

    // Create a daily meal
    const dailyMeal = await DailyMeal.create({
      meal_diary_id: mealDiaryJson.id,
      day_of_week: 1,
      breakfast: 'Oatmeal with berries',
      lunch: 'Chicken salad',
      dinner: 'Grilled salmon with vegetables'
    });
    const dailyMealJson = dailyMeal.toJSON();

    expect(dailyMealJson.id).toBeDefined();
    expect(dailyMealJson.meal_diary_id).toBe(mealDiaryJson.id);
    expect(dailyMealJson.day_of_week).toBe(1);
    expect(dailyMealJson.breakfast).toBe('Oatmeal with berries');
    expect(dailyMealJson.lunch).toBe('Chicken salad');
    expect(dailyMealJson.dinner).toBe('Grilled salmon with vegetables');
  }, 15000);

  it('should enforce day_of_week validation', async () => {
    // Create a test user
    const user = await User.create({
      username: 'vitest_test_day_validation',
      email: 'vitest_test_day_validation@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();

    // Create a family group
    const familyGroup = await FamilyGroup.create({
      name: 'Vitest - Day Validation Test',
      created_by: userJson.id
    });
    const familyGroupJson = familyGroup.toJSON();

    // Create a meal diary
    const mealDiary = await MealDiary.create({
      family_group_id: familyGroupJson.id,
      week_start_date: new Date('2024-01-15')
    });
    const mealDiaryJson = mealDiary.toJSON();

    // Try to create a daily meal with invalid day_of_week
    try {
      await DailyMeal.create({
        meal_diary_id: mealDiaryJson.id,
        day_of_week: 8 // Invalid: should be 1-7
      });
      expect.fail('Should have thrown a validation error');
    } catch (error) {
      expect(error instanceof ValidationError).toBe(true);
      expect((error as ValidationError).message).toContain('Validation error');
    }

    try {
      await DailyMeal.create({
        meal_diary_id: mealDiaryJson.id,
        day_of_week: 0 // Invalid: should be 1-7
      });
      expect.fail('Should have thrown a validation error');
    } catch (error) {
      expect(error instanceof ValidationError).toBe(true);
      expect((error as ValidationError).message).toContain('Validation error');
    }
  }, 15000);

  it('should enforce unique constraint on meal_diary_id and day_of_week', async () => {
    // Create a test user
    const user = await User.create({
      username: 'vitest_test_unique_constraint',
      email: 'vitest_test_unique_constraint@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();

    // Create a family group
    const familyGroup = await FamilyGroup.create({
      name: 'Vitest - Unique Constraint Test',
      created_by: userJson.id
    });
    const familyGroupJson = familyGroup.toJSON();

    // Create a meal diary
    const mealDiary = await MealDiary.create({
      family_group_id: familyGroupJson.id,
      week_start_date: new Date('2024-01-22')
    });
    const mealDiaryJson = mealDiary.toJSON();

    // Create first daily meal
    await DailyMeal.create({
      meal_diary_id: mealDiaryJson.id,
      day_of_week: 3,
      breakfast: 'Pancakes'
    });

    // Try to create another daily meal with the same meal_diary_id and day_of_week
    try {
      await DailyMeal.create({
        meal_diary_id: mealDiaryJson.id,
        day_of_week: 3,
        dinner: 'Pizza'
      });
      expect.fail('Should have thrown a unique constraint error');
    } catch (error) {
      expect(error).toBeDefined();
      // The error message might vary depending on the database, but it should indicate a unique constraint violation
    }
  }, 15000);

  it('should update a daily meal successfully', async () => {
    // Create a test user
    const user = await User.create({
      username: 'vitest_test_update_meal',
      email: 'vitest_test_update_meal@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();

    // Create a family group
    const familyGroup = await FamilyGroup.create({
      name: 'Vitest - Update Meal Test',
      created_by: userJson.id
    });
    const familyGroupJson = familyGroup.toJSON();

    // Create a meal diary
    const mealDiary = await MealDiary.create({
      family_group_id: familyGroupJson.id,
      week_start_date: new Date('2024-01-29')
    });
    const mealDiaryJson = mealDiary.toJSON();

    // Create a daily meal
    const dailyMeal = await DailyMeal.create({
      meal_diary_id: mealDiaryJson.id,
      day_of_week: 4,
      breakfast: 'Cereal',
      lunch: 'Sandwich',
      dinner: 'Pasta'
    });

    // Update the daily meal
    await dailyMeal.update({
      breakfast: 'Eggs and toast',
      dinner: 'Steak'
    });

    // Fetch the updated daily meal
    const updatedDailyMeal = await DailyMeal.findByPk(dailyMeal.dataValues.id);
    if (!updatedDailyMeal) {
      throw new Error('Daily meal not found');
    }

    const updatedDailyMealJson = updatedDailyMeal.toJSON();
    expect(updatedDailyMealJson.breakfast).toBe('Eggs and toast');
    expect(updatedDailyMealJson.lunch).toBe('Sandwich'); // Unchanged
    expect(updatedDailyMealJson.dinner).toBe('Steak');
  }, 15000);
});
