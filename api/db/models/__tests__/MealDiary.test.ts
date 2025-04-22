import { describe, it, expect } from 'vitest';
import { FamilyGroup, MealDiary, User } from '../../db.ts';

describe('MealDiary Model',  () => {
  it('should create a new meal diary successfully', async () => { 
    const user = await User.create({
      username: 'vitest_test_create_meal_diary',
      email: 'vitest_test_create_meal_diary@example.com',
      password_hash: 'hashedpassword123'
    });
    const userJson = user.toJSON();
    expect(userJson.id).toBeDefined();

    const familyGroup = await FamilyGroup.create({
      name: 'Vitest - Meal Diary Test',
      created_by: userJson.id
    });
    const familyGroupJson = familyGroup.toJSON();
    expect(familyGroupJson.id).toBeDefined();

    const mealDiary = await MealDiary.create({
      family_group_id: familyGroupJson.id,
      week_start_date: new Date('2024-01-01')
    });
    const mealDiaryJson = mealDiary.toJSON();

    expect(mealDiaryJson.id).toBeDefined();
    expect(mealDiaryJson.family_group_id).toBe(familyGroupJson.id);
    expect(mealDiaryJson.week_start_date).toBe('2024-01-01');
  }, 15000);
})
