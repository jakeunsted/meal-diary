import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

const mealDiaryFindByPk = vi.fn();
const dailyMealFindByPk = vi.fn();

vi.mock('../../db/models/associations.ts', () => ({
  User: {},
  MealDiary: { findByPk: (...args: unknown[]) => mealDiaryFindByPk(...args) },
  DailyMeal: { findByPk: (...args: unknown[]) => dailyMealFindByPk(...args) },
}));

vi.mock('../../services/dailyMeal.service.ts', () => ({
  createDailyMealEntry: vi.fn(),
  getDailyMealsByMealDiaryId: vi.fn(),
  updateDailyMealById: vi.fn(),
}));

import * as DailyMealService from '../../services/dailyMeal.service.ts';
import {
  createDailyMeal,
  getDailyMealsByMealDiaryId,
  updateDailyMealById,
} from '../daily-meal/dailyMeal.controller.ts';

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const user = { dataValues: { id: 5, family_group_id: 10 } };

const mockRequest = (params: Record<string, string> = {}, body: Record<string, unknown> = {}) =>
  ({ params, body, user }) as unknown as Request;

describe('dailyMeal.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mealDiaryFindByPk.mockResolvedValue({ dataValues: { family_group_id: 10 } });
  });

  it('creates a daily meal when the user owns the diary', async () => {
    vi.mocked(DailyMealService.createDailyMealEntry).mockResolvedValue({ id: 3 } as never);
    const res = mockResponse();

    await createDailyMeal(mockRequest({}, {
      meal_diary_id: '8',
      day_of_week: 2,
      breakfast: 'Toast',
      lunch: '',
      dinner: '',
    }), res);

    expect(DailyMealService.createDailyMealEntry).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 3 });
  });

  it('returns 400 when required create fields are missing and 403 for another family', async () => {
    const missing = mockResponse();
    await createDailyMeal(mockRequest({}, { meal_diary_id: '8' }), missing);
    expect(missing.status).toHaveBeenCalledWith(400);

    mealDiaryFindByPk.mockResolvedValue({ dataValues: { family_group_id: 99 } });
    const forbidden = mockResponse();
    await createDailyMeal(mockRequest({}, { meal_diary_id: '8', day_of_week: 1 }), forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(403);
  });

  it('lists meals for an owned diary and hides other families', async () => {
    vi.mocked(DailyMealService.getDailyMealsByMealDiaryId).mockResolvedValue([{ id: 1 }] as never);
    const res = mockResponse();

    await getDailyMealsByMealDiaryId(mockRequest({ meal_diary_id: '8' }), res);

    expect(DailyMealService.getDailyMealsByMealDiaryId).toHaveBeenCalledWith(8);
    expect(res.status).toHaveBeenCalledWith(200);

    const missing = mockResponse();
    await getDailyMealsByMealDiaryId(mockRequest({}), missing);
    expect(missing.status).toHaveBeenCalledWith(400);
  });

  it('updates an existing meal and returns 404 when it is missing', async () => {
    dailyMealFindByPk.mockResolvedValue({ dataValues: { meal_diary_id: 8 } });
    vi.mocked(DailyMealService.updateDailyMealById).mockResolvedValue({ id: 4 } as never);
    const res = mockResponse();

    await updateDailyMealById(mockRequest({ id: '4' }, { breakfast: 'Eggs' }), res);

    expect(res.status).toHaveBeenCalledWith(200);

    dailyMealFindByPk.mockResolvedValue(null);
    const missing = mockResponse();
    await updateDailyMealById(mockRequest({ id: '4' }, {}), missing);
    expect(missing.status).toHaveBeenCalledWith(404);
  });
});
