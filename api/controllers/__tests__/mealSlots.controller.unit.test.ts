import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../db/models/associations.ts', () => ({
  User: class User {},
}));

vi.mock('../../services/mealSlots.service.ts', () => {
  class MealSlotsConfirmationRequiredError extends Error {
    readonly code = 'MEAL_SLOTS_CONFIRMATION_REQUIRED';
    readonly removed: unknown[];

    constructor(removed: unknown[]) {
      super('MEAL_SLOTS_CONFIRMATION_REQUIRED');
      this.name = 'MealSlotsConfirmationRequiredError';
      this.removed = removed;
    }
  }

  class MealSlotsValidationError extends Error {
    readonly code = 'MEAL_SLOTS_VALIDATION_ERROR';

    constructor(message: string) {
      super(message);
      this.name = 'MealSlotsValidationError';
    }
  }

  class MealNamesResetForbiddenError extends Error {
    constructor() {
      super('Only the family owner can reset meal names');
      this.name = 'MealNamesResetForbiddenError';
    }
  }

  return {
    MealSlotsConfirmationRequiredError,
    MealSlotsValidationError,
    MealNamesResetForbiddenError,
    getActiveMealSlots: vi.fn(),
    replaceMealSlots: vi.fn(),
    scheduleMealNamesReset: vi.fn(),
  };
});

vi.mock('../../services/entitlements.service.ts', () => ({
  assertFeature: vi.fn(),
  resolveEntitlements: vi.fn(),
}));

vi.mock('../../middleware/entitlement.middleware.ts', () => ({
  handleEntitlementError: vi.fn(() => false),
}));

vi.mock('../../services/sse.service.ts', () => ({
  emitFamilyEvent: vi.fn(),
}));

vi.mock('../../utils/posthog.ts', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
  sanitizeErrorForAnalytics: vi.fn(() => ({
    error_type: 'Error',
    error_message: 'sanitized',
  })),
}));

vi.mock('../../utils/otelLogs.ts', () => ({
  emitLog: vi.fn(),
}));

import { handleEntitlementError } from '../../middleware/entitlement.middleware.ts';
import * as EntitlementsService from '../../services/entitlements.service.ts';
import {
  MealNamesResetForbiddenError,
  MealSlotsConfirmationRequiredError,
  MealSlotsValidationError,
  getActiveMealSlots,
  replaceMealSlots,
  scheduleMealNamesReset,
} from '../../services/mealSlots.service.ts';
import { emitFamilyEvent } from '../../services/sse.service.ts';
import { emitLog } from '../../utils/otelLogs.ts';
import {
  getMealSlots,
  resetMealNamesToDefaults,
  updateMealSlots,
} from '../meal-slots/mealSlots.controller.ts';

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const mockRequest = (params: Record<string, string>, body: Record<string, unknown> = {}) =>
  ({
    params,
    body,
    user: { dataValues: { id: 5 } },
  }) as unknown as Request;

describe('mealSlots.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(handleEntitlementError).mockReturnValue(false);
  });

  it('returns active slots and rejects an invalid family id', async () => {
    vi.mocked(getActiveMealSlots).mockResolvedValue([{ id: 1 }] as never);
    const res = mockResponse();

    await getMealSlots(mockRequest({ family_group_id: '9' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ slots: [{ id: 1 }] });

    const invalid = mockResponse();
    await getMealSlots(mockRequest({ family_group_id: '0' }), invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);
  });

  it('replaces slots, emits the family event, and maps confirmation and validation errors', async () => {
    vi.mocked(replaceMealSlots).mockResolvedValue({ slots: [{ id: 2 }] } as never);
    const res = mockResponse();

    await updateMealSlots(mockRequest({ family_group_id: '9' }, {
      slots: [{ name: 'Supper' }],
      today: '2026-10-23',
    }), res);

    expect(emitFamilyEvent).toHaveBeenCalledWith(9, 'meal-slots-updated', {
      slots: [{ id: 2 }],
      today: '2026-10-23',
    });
    expect(res.status).toHaveBeenCalledWith(200);

    const missingBody = mockResponse();
    await updateMealSlots(mockRequest({ family_group_id: '9' }, {}), missingBody);
    expect(missingBody.status).toHaveBeenCalledWith(400);

    const removed = [{ id: 3, name: 'Supper', futureMealsWithContent: 1 }];
    vi.mocked(replaceMealSlots).mockRejectedValueOnce(
      new MealSlotsConfirmationRequiredError(removed)
    );
    const confirm = mockResponse();
    await updateMealSlots(mockRequest({ family_group_id: '9' }, {
      slots: [],
      today: '2026-10-23',
    }), confirm);
    expect(confirm.status).toHaveBeenCalledWith(409);
    expect(confirm.json).toHaveBeenCalledWith({
      code: 'MEAL_SLOTS_CONFIRMATION_REQUIRED',
      removed,
    });

    vi.mocked(replaceMealSlots).mockRejectedValueOnce(new MealSlotsValidationError('Name is required'));
    const invalid = mockResponse();
    await updateMealSlots(mockRequest({ family_group_id: '9' }, {
      slots: [],
      today: '2026-10-23',
    }), invalid);
    expect(invalid.status).toHaveBeenCalledWith(400);

    vi.mocked(EntitlementsService.assertFeature).mockRejectedValueOnce(new Error('upgrade'));
    vi.mocked(handleEntitlementError).mockReturnValueOnce(true);
    const gated = mockResponse();
    await updateMealSlots(mockRequest({ family_group_id: '9' }, {
      slots: [],
      today: '2026-10-23',
    }), gated);
    expect(gated.status).not.toHaveBeenCalled();
  });

  it('resets meal names and maps a forbidden reset', async () => {
    vi.mocked(scheduleMealNamesReset).mockResolvedValue(undefined as never);
    vi.mocked(EntitlementsService.resolveEntitlements).mockResolvedValue({ plan: 'free' } as never);
    const res = mockResponse();

    await resetMealNamesToDefaults(mockRequest({ family_group_id: '9' }, { today: '2026-10-23' }), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ plan: 'free' });

    vi.mocked(scheduleMealNamesReset).mockRejectedValueOnce(new MealNamesResetForbiddenError());
    const forbidden = mockResponse();
    await resetMealNamesToDefaults(mockRequest({ family_group_id: '9' }, { today: '2026-10-23' }), forbidden);
    expect(forbidden.status).toHaveBeenCalledWith(403);

    vi.mocked(scheduleMealNamesReset).mockRejectedValueOnce(new Error('db down'));
    const failed = mockResponse();
    await resetMealNamesToDefaults(mockRequest({ family_group_id: '9' }, { today: '2026-10-23' }), failed);
    expect(emitLog).toHaveBeenCalled();
    expect(failed.status).toHaveBeenCalledWith(500);
  });
});
