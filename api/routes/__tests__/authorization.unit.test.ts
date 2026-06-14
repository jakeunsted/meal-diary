import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

process.env.JWT_ACCESS_SECRET = 'unit-test-secret';
delete process.env.POSTHOG_KEY;

vi.mock('../../services/user.service.ts', () => ({
  createUser: vi.fn(),
  getUserById: vi.fn(),
  updateUser: vi.fn(),
  deleteUserAccount: vi.fn(),
}));

vi.mock('../../services/dataExport.service.ts', () => ({
  exportUserData: vi.fn(),
}));

vi.mock('../../services/recipe.service.ts', () => ({
  getRecipesByFamilyGroup: vi.fn(),
  getRecipeById: vi.fn(),
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  deleteRecipe: vi.fn(),
}));

vi.mock('../../services/shoppingList.service.ts', () => ({
  createBaseShoppingList: vi.fn(),
  getEntireShoppingList: vi.fn(),
  addCategory: vi.fn(),
  deleteCategory: vi.fn(),
  getFamilyCategories: vi.fn(),
  addItem: vi.fn(),
  bulkAddItems: vi.fn(),
  updateItem: vi.fn(),
  reorderItems: vi.fn(),
  deleteItem: vi.fn(),
}));

vi.mock('../../services/familyGroup.service.ts', () => ({
  deleteFamilyGroupData: vi.fn(),
  leaveFamilyGroup: vi.fn(),
  transferFamilyGroupOwnership: vi.fn(),
  deleteFamilyGroup: vi.fn(),
}));

vi.mock('../../services/mealDiary.service.ts', () => ({
  createNewWeeklyMeals: vi.fn(),
  getWeeklyMeals: vi.fn(),
  updateDailyMeal: vi.fn(),
}));

vi.mock('../../services/dailyMeal.service.ts', () => ({
  createDailyMealEntry: vi.fn(),
  updateDailyMealById: vi.fn(),
  getDailyMealsByMealDiaryId: vi.fn(),
}));

vi.mock('../../services/webhook.service.ts', () => ({
  sendDailyMealWebhook: vi.fn(),
  sendShoppingListItemWebhook: vi.fn(),
  sendShoppingListCategoryWebhook: vi.fn(),
}));

import {
  User,
  FamilyGroup,
  MealDiary,
  DailyMeal,
} from '../../db/models/associations.ts';
import ShoppingList from '../../db/models/ShoppingList.model.ts';
import * as UserService from '../../services/user.service.ts';
import * as DataExportService from '../../services/dataExport.service.ts';
import * as FamilyGroupService from '../../services/familyGroup.service.ts';
import * as RecipeService from '../../services/recipe.service.ts';
import * as ShoppingListService from '../../services/shoppingList.service.ts';
import userRoutes from '../userRoutes.routes.ts';
import familyGroupRoutes from '../familyGroups.routes.ts';
import mealDiaryRoutes from '../mealDiary.routes.ts';
import shoppingListRoutes from '../shoppingList.routes.ts';
import recipeRoutes from '../recipes.routes.ts';
import dailyMealRoutes from '../dailyMeal.routes.ts';

const app = express();
app.use(express.json());
app.use('/users', userRoutes);
app.use('/family-groups', familyGroupRoutes);
app.use('/meal-diaries', mealDiaryRoutes);
app.use('/shopping-list', shoppingListRoutes);
app.use('/recipes', recipeRoutes);
app.use('/daily-meals', dailyMealRoutes);

const fakeUser = (id: number, familyGroupId: number | null = null) =>
  ({
    dataValues: { id, family_group_id: familyGroupId },
    toJSON() {
      return { id, family_group_id: familyGroupId };
    },
  }) as unknown as User;

const tokenFor = (userId: number) =>
  jwt.sign({ userId }, process.env.JWT_ACCESS_SECRET!);

// Authenticated caller for all tests: user 1, member of family group 1
const authedUser = fakeUser(1, 1);
const auth = { Authorization: `Bearer ${tokenFor(1)}` };

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.spyOn(User, 'findByPk').mockResolvedValue(authedUser);
});

describe('user routes authorization', () => {
  it('rejects requests without a token', async () => {
    const res = await request(app).get('/users/1');
    expect(res.status).toBe(401);
  });

  it('GET /users no longer exists', async () => {
    const res = await request(app).get('/users').set(auth);
    expect(res.status).toBe(404);
  });

  it("user A cannot GET user B's record", async () => {
    const res = await request(app).get('/users/2').set(auth);
    expect(res.status).toBe(403);
    expect(UserService.getUserById).not.toHaveBeenCalled();
  });

  it("user A cannot PUT user B's record", async () => {
    const res = await request(app)
      .put('/users/2')
      .set(auth)
      .send({ username: 'hijacked' });
    expect(res.status).toBe(403);
    expect(UserService.updateUser).not.toHaveBeenCalled();
  });

  it('DELETE /users/:id no longer exists — deletion is /users/me only', async () => {
    const res = await request(app).delete('/users/2').set(auth);
    expect(res.status).toBe(404);
    expect(UserService.deleteUserAccount).not.toHaveBeenCalled();
  });

  it('user A can GET their own record', async () => {
    vi.mocked(UserService.getUserById).mockResolvedValue({
      id: 1,
      username: 'me',
      email: 'me@example.com',
      has_password: true,
    });
    const res = await request(app).get('/users/1').set(auth);
    expect(res.status).toBe(200);
    expect(UserService.getUserById).toHaveBeenCalledWith(1);
  });
});

describe('DELETE /users/me', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).delete('/users/me').send({ password: 'pw' });
    expect(res.status).toBe(401);
    expect(UserService.deleteUserAccount).not.toHaveBeenCalled();
  });

  it('deletes the authenticated user with their own id', async () => {
    vi.mocked(UserService.deleteUserAccount).mockResolvedValue(undefined);

    const res = await request(app)
      .delete('/users/me')
      .set(auth)
      .send({ password: 'correct-password' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deletedAt: expect.any(String) });
    expect(UserService.deleteUserAccount).toHaveBeenCalledWith(1, {
      password: 'correct-password',
      confirmation: undefined,
    });
  });

  it('maps an incorrect password to 403', async () => {
    vi.mocked(UserService.deleteUserAccount).mockRejectedValue(
      new Error('Password is incorrect')
    );

    const res = await request(app)
      .delete('/users/me')
      .set(auth)
      .send({ password: 'wrong' });

    expect(res.status).toBe(403);
  });

  it('maps a family group with other members to 409', async () => {
    vi.mocked(UserService.deleteUserAccount).mockRejectedValue(
      new Error('You created a family group that still has other members. Delete the family or transfer ownership before deleting your account')
    );

    const res = await request(app)
      .delete('/users/me')
      .set(auth)
      .send({ password: 'correct-password' });

    expect(res.status).toBe(409);
  });
});

describe('GET /users/me/export', () => {
  const bundle = {
    exportedAt: '2026-06-14T00:00:00.000Z',
    user: { id: 1, email: 'jake@example.com' },
    familyGroup: null,
    recipes: [],
    mealDiaries: [],
    shoppingLists: [],
  };

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/users/me/export');
    expect(res.status).toBe(401);
    expect(DataExportService.exportUserData).not.toHaveBeenCalled();
  });

  it('returns the export for the authenticated user as a JSON attachment', async () => {
    vi.mocked(DataExportService.exportUserData).mockResolvedValue(bundle as never);

    const res = await request(app).get('/users/me/export').set(auth);

    expect(res.status).toBe(200);
    expect(DataExportService.exportUserData).toHaveBeenCalledWith(1);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=/);
    expect(res.body).toMatchObject({ exportedAt: expect.any(String), user: { id: 1 } });
    expect(JSON.stringify(res.body)).not.toContain('password_hash');
  });

  it('maps a missing user to 404', async () => {
    vi.mocked(DataExportService.exportUserData).mockRejectedValue(new Error('User not found'));

    const res = await request(app).get('/users/me/export').set(auth);
    expect(res.status).toBe(404);
  });
});

describe('family group routes authorization', () => {
  it('member can GET their own family group', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue({
      dataValues: { id: 1, name: 'Mine' },
    } as unknown as FamilyGroup);

    const res = await request(app).get('/family-groups/1').set(auth);
    expect(res.status).toBe(200);
  });

  it("non-member cannot GET another family's group", async () => {
    const findByPk = vi.spyOn(FamilyGroup, 'findByPk');
    const res = await request(app).get('/family-groups/2').set(auth);
    expect(res.status).toBe(403);
    expect(findByPk).not.toHaveBeenCalled();
  });

  it('member can GET their own family members', async () => {
    vi.spyOn(FamilyGroup, 'findByPk').mockResolvedValue({
      dataValues: { id: 1 },
    } as unknown as FamilyGroup);
    vi.spyOn(User, 'findAll').mockResolvedValue([]);

    const res = await request(app).get('/family-groups/1/members').set(auth);
    expect(res.status).toBe(200);
  });

  it("non-member cannot GET another family's members", async () => {
    const res = await request(app).get('/family-groups/2/members').set(auth);
    expect(res.status).toBe(403);
  });

  it('join uses the authenticated user id, ignoring user_id in the body', async () => {
    vi.spyOn(FamilyGroup, 'findOne').mockResolvedValue({
      dataValues: { id: 5 },
    } as unknown as FamilyGroup);
    const update = vi.spyOn(User, 'update').mockResolvedValue([1]);

    const res = await request(app)
      .post('/family-groups/join')
      .set(auth)
      .send({ random_identifier: 'aaaa-bbbb-cccc', user_id: 999 });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalledWith(
      { family_group_id: 5 },
      { where: { id: 1 } }
    );
  });

  it('create uses the authenticated user as creator, ignoring created_by in the body', async () => {
    vi.spyOn(FamilyGroup, 'findOne').mockResolvedValue(null);
    const create = vi.spyOn(FamilyGroup, 'create').mockResolvedValue({
      dataValues: { id: 7, name: 'New family' },
    } as unknown as FamilyGroup);
    vi.spyOn(User, 'update').mockResolvedValue([1]);
    vi.spyOn(ShoppingList, 'create').mockResolvedValue(
      {} as unknown as ShoppingList
    );

    const res = await request(app)
      .post('/family-groups')
      .set(auth)
      .send({ name: 'New family', created_by: 999 });

    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New family', created_by: 1 })
    );
  });
});

describe('family lifecycle routes authorization', () => {
  it("non-member cannot leave another family's group", async () => {
    const res = await request(app).post('/family-groups/2/leave').set(auth);
    expect(res.status).toBe(403);
    expect(FamilyGroupService.leaveFamilyGroup).not.toHaveBeenCalled();
  });

  it('member leave routes through to the service with their own id', async () => {
    vi.mocked(FamilyGroupService.leaveFamilyGroup).mockResolvedValue(undefined);

    const res = await request(app).post('/family-groups/1/leave').set(auth);

    expect(res.status).toBe(200);
    expect(FamilyGroupService.leaveFamilyGroup).toHaveBeenCalledWith(1, 1);
  });

  it('owner-cannot-leave service error maps to 409', async () => {
    vi.mocked(FamilyGroupService.leaveFamilyGroup).mockRejectedValue(
      new Error('The family owner cannot leave. Transfer ownership or delete the family first')
    );

    const res = await request(app).post('/family-groups/1/leave').set(auth);
    expect(res.status).toBe(409);
  });

  it("non-member cannot delete another family's group", async () => {
    const res = await request(app).delete('/family-groups/2').set(auth);
    expect(res.status).toBe(403);
    expect(FamilyGroupService.deleteFamilyGroup).not.toHaveBeenCalled();
  });

  it('non-owner member delete maps to 403 from the service', async () => {
    vi.mocked(FamilyGroupService.deleteFamilyGroup).mockRejectedValue(
      new Error('Only the family owner can delete the family group')
    );

    const res = await request(app).delete('/family-groups/1').set(auth);
    expect(res.status).toBe(403);
  });

  it('owner delete routes through to the service', async () => {
    vi.mocked(FamilyGroupService.deleteFamilyGroup).mockResolvedValue(undefined);

    const res = await request(app).delete('/family-groups/1').set(auth);

    expect(res.status).toBe(200);
    expect(FamilyGroupService.deleteFamilyGroup).toHaveBeenCalledWith(1, 1);
  });

  it("non-member cannot transfer another family's ownership", async () => {
    const res = await request(app)
      .post('/family-groups/2/transfer-ownership')
      .set(auth)
      .send({ new_owner_id: 3 });
    expect(res.status).toBe(403);
    expect(FamilyGroupService.transferFamilyGroupOwnership).not.toHaveBeenCalled();
  });

  it('transfer requires new_owner_id', async () => {
    const res = await request(app)
      .post('/family-groups/1/transfer-ownership')
      .set(auth)
      .send({});
    expect(res.status).toBe(400);
  });

  it('owner transfer routes through to the service', async () => {
    vi.mocked(FamilyGroupService.transferFamilyGroupOwnership).mockResolvedValue(undefined);

    const res = await request(app)
      .post('/family-groups/1/transfer-ownership')
      .set(auth)
      .send({ new_owner_id: 3 });

    expect(res.status).toBe(200);
    expect(FamilyGroupService.transferFamilyGroupOwnership).toHaveBeenCalledWith(1, 1, 3);
  });
});

describe('recipe routes authorization', () => {
  it("non-member cannot list another family's recipes", async () => {
    const res = await request(app).get('/recipes/family/2').set(auth);
    expect(res.status).toBe(403);
    expect(RecipeService.getRecipesByFamilyGroup).not.toHaveBeenCalled();
  });

  it('member can list their own family recipes', async () => {
    vi.mocked(RecipeService.getRecipesByFamilyGroup).mockResolvedValue([]);
    const res = await request(app).get('/recipes/family/1').set(auth);
    expect(res.status).toBe(200);
  });

  it("cannot GET another family's recipe by id", async () => {
    vi.mocked(RecipeService.getRecipeById).mockResolvedValue({
      dataValues: { id: 9, family_group_id: 2 },
    } as never);
    const res = await request(app).get('/recipes/9').set(auth);
    expect(res.status).toBe(403);
  });

  it('can GET own family recipe by id', async () => {
    vi.mocked(RecipeService.getRecipeById).mockResolvedValue({
      dataValues: { id: 9, family_group_id: 1 },
    } as never);
    const res = await request(app).get('/recipes/9').set(auth);
    expect(res.status).toBe(200);
  });

  it("cannot PUT another family's recipe", async () => {
    vi.mocked(RecipeService.getRecipeById).mockResolvedValue({
      dataValues: { id: 9, family_group_id: 2 },
    } as never);
    const res = await request(app)
      .put('/recipes/9')
      .set(auth)
      .send({ name: 'Hijack' });
    expect(res.status).toBe(403);
    expect(RecipeService.updateRecipe).not.toHaveBeenCalled();
  });

  it("cannot DELETE another family's recipe", async () => {
    vi.mocked(RecipeService.getRecipeById).mockResolvedValue({
      dataValues: { id: 9, family_group_id: 2 },
    } as never);
    const res = await request(app).delete('/recipes/9').set(auth);
    expect(res.status).toBe(403);
    expect(RecipeService.deleteRecipe).not.toHaveBeenCalled();
  });

  it('cannot create a recipe in another family group', async () => {
    const res = await request(app)
      .post('/recipes')
      .set(auth)
      .send({ family_group_id: 2, name: 'Sneaky recipe' });
    expect(res.status).toBe(403);
    expect(RecipeService.createRecipe).not.toHaveBeenCalled();
  });
});

describe('meal diary routes authorization', () => {
  it("non-member cannot GET another family's meal diary", async () => {
    const findOne = vi.spyOn(MealDiary, 'findOne');
    const res = await request(app).get('/meal-diaries/2').set(auth);
    expect(res.status).toBe(403);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('cannot create a meal diary for another family group', async () => {
    const create = vi.spyOn(MealDiary, 'create');
    const res = await request(app)
      .post('/meal-diaries')
      .set(auth)
      .send({ family_group_id: 2, week_start_date: '2026-06-08' });
    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("non-member cannot GET another family's weekly meals", async () => {
    const res = await request(app)
      .get('/meal-diaries/2/daily-meals?week_start_date=2026-06-08')
      .set(auth);
    expect(res.status).toBe(403);
  });

  it("non-member cannot PATCH another family's daily meals", async () => {
    const res = await request(app)
      .patch('/meal-diaries/2/daily-meals')
      .set(auth)
      .send({ week_start_date: '2026-06-08', day_of_week: 1, dinner: 'Pizza' });
    expect(res.status).toBe(403);
  });
});

describe('shopping list routes authorization', () => {
  it("non-member cannot GET another family's shopping list", async () => {
    const res = await request(app).get('/shopping-list/2').set(auth);
    expect(res.status).toBe(403);
    expect(ShoppingListService.getEntireShoppingList).not.toHaveBeenCalled();
  });

  it('member can GET their own shopping list', async () => {
    vi.mocked(ShoppingListService.getEntireShoppingList).mockResolvedValue({
      id: 1,
      family_group_id: 1,
      get: () => 1,
    } as never);
    const res = await request(app).get('/shopping-list/1').set(auth);
    expect(res.status).toBe(200);
  });

  it("non-member cannot DELETE items from another family's list", async () => {
    const res = await request(app)
      .delete('/shopping-list/2/items/3')
      .set(auth);
    expect(res.status).toBe(403);
    expect(ShoppingListService.deleteItem).not.toHaveBeenCalled();
  });
});

describe('daily meal routes authorization', () => {
  it("non-member cannot GET daily meals from another family's diary", async () => {
    vi.spyOn(MealDiary, 'findByPk').mockResolvedValue({
      dataValues: { id: 10, family_group_id: 2 },
    } as unknown as MealDiary);

    const res = await request(app).get('/daily-meals/10').set(auth);
    expect(res.status).toBe(403);
  });

  it("non-member cannot PUT a daily meal in another family's diary", async () => {
    vi.spyOn(DailyMeal, 'findByPk').mockResolvedValue({
      dataValues: { id: 5, meal_diary_id: 10 },
    } as unknown as DailyMeal);
    vi.spyOn(MealDiary, 'findByPk').mockResolvedValue({
      dataValues: { id: 10, family_group_id: 2 },
    } as unknown as MealDiary);

    const res = await request(app)
      .put('/daily-meals/5')
      .set(auth)
      .send({ dinner: 'Pizza' });
    expect(res.status).toBe(403);
  });
});
