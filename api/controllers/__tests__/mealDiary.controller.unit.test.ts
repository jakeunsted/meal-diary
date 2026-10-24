import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mealDiaryCreate = vi.fn();
const mealDiaryFindOne = vi.fn();

vi.mock('../../db/models/associations.ts', () => ({
  MealDiary: {
    create: (...args: unknown[]) => mealDiaryCreate(...args),
    findOne: (...args: unknown[]) => mealDiaryFindOne(...args),
  },
  DailyMeal: {},
  User: class User {},
}));

vi.mock('../../services/mealDiary.service.ts', () => ({
  createNewWeeklyMeals: vi.fn(),
  getWeeklyMeals: vi.fn(),
  updateDailyMealWithSlots: vi.fn(),
}));

vi.mock('../../services/mealSlots.service.ts', () => ({
  RECIPE_NOT_IN_FAMILY_MESSAGE: 'Recipe does not belong to this family group',
}));

vi.mock('../../services/mealDiarySync.service.ts', () => {
  class MealDiarySyncValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'MealDiarySyncValidationError';
    }
  }

  return {
    MealDiarySyncValidationError,
    parseMealDiarySyncSlots: vi.fn((slots: unknown) => slots),
    parseMealDiaryResolveSlots: vi.fn((slots: unknown) => slots),
    syncMealDiarySlots: vi.fn(),
    resolveMealDiarySync: vi.fn(),
  };
});

vi.mock('../../services/webhook.service.ts', () => ({
  sendDailyMealWebhook: vi.fn(),
}));

vi.mock('../../services/entitlements.service.ts', () => ({
  assertCanNavigateWeek: vi.fn(),
  assertCanUpdateMealWeek: vi.fn(),
}));

vi.mock('../../middleware/entitlement.middleware.ts', () => ({
  handleEntitlementError: vi.fn(() => false),
}));

vi.mock('../../utils/posthog.ts', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

import { handleEntitlementError } from '../../middleware/entitlement.middleware.ts';
import {
  createNewWeeklyMeals,
  getWeeklyMeals,
  updateDailyMealWithSlots,
} from '../../services/mealDiary.service.ts';
import {
  MealDiarySyncValidationError,
  resolveMealDiarySync,
  syncMealDiarySlots,
} from '../../services/mealDiarySync.service.ts';
import { sendDailyMealWebhook } from '../../services/webhook.service.ts';
import { trackEvent } from '../../utils/posthog.ts';
import {
  createMealDiary,
  getMealDiaryByFamilyGroupId,
  getWeeklyMealsForFamilyGroup,
  resolveDailyMealSyncForFamilyGroup,
  syncDailyMealsForFamilyGroup,
  updateDailyMealForFamilyGroup,
} from '../meal-diary/mealDiary.controller.ts';

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const mockRequest = (
  params: Record<string, string> = {},
  body: Record<string, unknown> = {},
  query: Record<string, unknown> = {},
  familyGroupId = 10
) =>
  ({
    params,
    body,
    query,
    user: { dataValues: { id: 5, family_group_id: familyGroupId } },
  }) as unknown as Request;

describe('mealDiary.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handleEntitlementError).mockReturnValue(false);
  });

  it('creates a meal diary for the signed-in family', async () => {
    mealDiaryCreate.mockResolvedValue({ id: 1 });
    const res = mockResponse();

    await createMealDiary(mockRequest({}, { family_group_id: '10', week_start_date: '2026-10-19' }), res);

    expect(res.status).toHaveBeenCalledWith(201);

    const missing = mockResponse();
    await createMealDiary(mockRequest({}, { family_group_id: '10' }), missing);
    expect(missing.status).toHaveBeenCalledWith(400);

    const forbidden = mockResponse();
    await createMealDiary(mockRequest({}, { family_group_id: '11', week_start_date: '2026-10-19' }), forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(403);
  });

  it('returns an existing diary or creates one for the current week', async () => {
    mealDiaryFindOne.mockResolvedValue({ id: 2 });
    const existing = mockResponse();
    await getMealDiaryByFamilyGroupId(mockRequest({ family_group_id: '10' }), existing);
    expect(existing.status).toHaveBeenCalledWith(200);
    expect(mealDiaryCreate).not.toHaveBeenCalled();

    mealDiaryFindOne.mockResolvedValue(null);
    mealDiaryCreate.mockResolvedValue({ id: 3 });
    const created = mockResponse();
    await getMealDiaryByFamilyGroupId(mockRequest({ family_group_id: '10' }), created);
    expect(mealDiaryCreate).toHaveBeenCalled();
    expect(created.status).toHaveBeenCalledWith(200);

    const missing = mockResponse();
    await getMealDiaryByFamilyGroupId(mockRequest({}), missing);
    expect(missing.status).toHaveBeenCalledWith(400);
  });

  it('loads weekly meals and creates the week when none exist', async () => {
    vi.mocked(getWeeklyMeals).mockResolvedValue(null as never);
    vi.mocked(createNewWeeklyMeals).mockResolvedValue([
      { breakfast: '', lunch: '', dinner: '' },
    ] as never);
    const res = mockResponse();

    await getWeeklyMealsForFamilyGroup(
      mockRequest({ family_group_id: '10' }, {}, { week_start_date: '2026-10-19' }),
      res
    );

    expect(createNewWeeklyMeals).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);

    const invalidDate = mockResponse();
    await getWeeklyMealsForFamilyGroup(
      mockRequest({ family_group_id: '10' }, {}, { week_start_date: 'not-a-date' }),
      invalidDate
    );
    expect(invalidDate.status).toHaveBeenCalledWith(400);

    const denied = mockResponse();
    await getWeeklyMealsForFamilyGroup(
      mockRequest({ family_group_id: '11' }, {}, { week_start_date: '2026-10-19' }, 10),
      denied
    );
    expect(denied.status).toHaveBeenCalledWith(403);
  });

  it('updates a day and maps recipe and missing-diary errors', async () => {
    vi.mocked(updateDailyMealWithSlots).mockResolvedValue({
      meal: { dataValues: { day_of_week: 1 } },
      response: { day_of_week: 1, breakfast: 'Toast' },
    } as never);
    const res = mockResponse();

    await updateDailyMealForFamilyGroup(mockRequest({ family_group_id: '10' }, {
      week_start_date: '2026-10-19',
      day_of_week: 1,
      breakfast: 'Toast',
    }), res);

    expect(sendDailyMealWebhook).toHaveBeenCalled();
    expect(trackEvent).toHaveBeenCalledWith('5', 'meal_updated', expect.objectContaining({
      meal_types: ['breakfast'],
    }));
    expect(res.status).toHaveBeenCalledWith(200);

    const outOfRange = mockResponse();
    await updateDailyMealForFamilyGroup(mockRequest({ family_group_id: '10' }, {
      week_start_date: '2026-10-19',
      day_of_week: 9,
    }), outOfRange);
    expect(outOfRange.status).toHaveBeenCalledWith(400);

    vi.mocked(updateDailyMealWithSlots).mockRejectedValueOnce(
      new Error('Recipe does not belong to this family group')
    );
    const wrongRecipe = mockResponse();
    await updateDailyMealForFamilyGroup(mockRequest({ family_group_id: '10' }, {
      week_start_date: '2026-10-19',
      day_of_week: 1,
    }), wrongRecipe);
    expect(wrongRecipe.status).toHaveBeenCalledWith(400);

    vi.mocked(updateDailyMealWithSlots).mockRejectedValueOnce(new Error('Meal diary not found for this week'));
    const missing = mockResponse();
    await updateDailyMealForFamilyGroup(mockRequest({ family_group_id: '10' }, {
      week_start_date: '2026-10-19',
      day_of_week: 1,
    }), missing);
    expect(missing.status).toHaveBeenCalledWith(404);
  });

  it('syncs and resolves diary slots', async () => {
    const result = {
      dailyMeals: [{
        day_of_week: 1,
        breakfast: 'Toast',
        lunch: '',
        dinner: '',
        breakfast_recipe_id: null,
        lunch_recipe_id: null,
        dinner_recipe_id: null,
        slots: [],
      }],
      results: [{ status: 'applied' }],
      appliedDays: [{ day_of_week: 1, mealTypes: ['breakfast'] }],
    };
    vi.mocked(syncMealDiarySlots).mockResolvedValue(result as never);
    const synced = mockResponse();

    await syncDailyMealsForFamilyGroup(mockRequest({ family_group_id: '10' }, {
      week_start_date: '2026-10-19',
      slots: [{ day_of_week: 1 }],
    }), synced);

    expect(synced.status).toHaveBeenCalledWith(200);
    expect(synced.json).toHaveBeenCalledWith({
      dailyMeals: result.dailyMeals,
      results: result.results,
    });
    expect(sendDailyMealWebhook).toHaveBeenCalled();

    vi.mocked(syncMealDiarySlots).mockRejectedValueOnce(new MealDiarySyncValidationError('Slot is invalid'));
    const invalid = mockResponse();
    await syncDailyMealsForFamilyGroup(mockRequest({ family_group_id: '10' }, {
      week_start_date: '2026-10-19',
      slots: [],
    }), invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);

    vi.mocked(resolveMealDiarySync).mockResolvedValue({
      ...result,
      appliedDays: [],
    } as never);
    const resolved = mockResponse();
    await resolveDailyMealSyncForFamilyGroup(mockRequest({ family_group_id: '10' }, {
      week_start_date: '2026-10-19',
      keep_mine: [],
    }), resolved);
    expect(resolved.status).toHaveBeenCalledWith(200);

    const missing = mockResponse();
    await syncDailyMealsForFamilyGroup(mockRequest({ family_group_id: '10' }, {}), missing);
    expect(missing.status).toHaveBeenCalledWith(400);
  });
});
