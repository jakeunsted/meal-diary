import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import type User from '../../db/models/User.model.ts';

const assertFeature = vi.fn();

vi.mock('../../services/entitlements.service.ts', () => {
  class EntitlementRequiredError extends Error {
    readonly code = 'ENTITLEMENT_REQUIRED';

    constructor(
      readonly feature: string,
      readonly plan: string
    ) {
      super('ENTITLEMENT_REQUIRED');
      this.name = 'EntitlementRequiredError';
    }
  }

  return {
    assertFeature: (...args: unknown[]) => assertFeature(...args),
    EntitlementRequiredError,
  };
});

import { EntitlementRequiredError } from '../../services/entitlements.service.ts';
import { handleEntitlementError, requireEntitlement } from '../entitlement.middleware.ts';

const fakeUser = (id: number) => ({ dataValues: { id } }) as unknown as User;

const mockRes = () =>
  ({ status: vi.fn().mockReturnThis(), json: vi.fn() }) as unknown as Response;

const mockReq = (params: Record<string, string>, user?: User) =>
  ({ params, user }) as unknown as Request;

describe('handleEntitlementError', () => {
  it('responds 403 with an upgrade path for an entitlement error', () => {
    const res = mockRes();
    const handled = handleEntitlementError(new EntitlementRequiredError('recipes', 'free'), res);

    expect(handled).toBe(true);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      code: 'ENTITLEMENT_REQUIRED',
      feature: 'recipes',
      plan: 'free',
      upgradeUrl: '/plans',
    });
  });

  it('ignores other errors', () => {
    const res = mockRes();
    expect(handleEntitlementError(new Error('nope'), res)).toBe(false);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe('requireEntitlement', () => {
  beforeEach(() => {
    assertFeature.mockReset();
  });

  it('returns 400 when the family group id is missing', async () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireEntitlement('recipes')(mockReq({}), res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid family group ID' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the request has no user', async () => {
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireEntitlement('recipes')(mockReq({ family_group_id: '4' }), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('sets entitlements and calls next when the feature is allowed', async () => {
    const entitlements = { plan: 'premium' };
    assertFeature.mockResolvedValue(entitlements);
    const req = mockReq({ id: '9' }, fakeUser(3));
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireEntitlement('weeks_ahead')(req, res, next);

    expect(assertFeature).toHaveBeenCalledWith(9, 3, 'weeks_ahead');
    expect(req.entitlements).toBe(entitlements);
    expect(next).toHaveBeenCalledWith();
  });

  it('returns 403 when the feature is not entitled', async () => {
    assertFeature.mockRejectedValue(new EntitlementRequiredError('custom_meal_slots', 'free'));
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireEntitlement('custom_meal_slots')(mockReq({ family_group_id: '4' }, fakeUser(3)), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      code: 'ENTITLEMENT_REQUIRED',
      feature: 'custom_meal_slots',
      plan: 'free',
      upgradeUrl: '/plans',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('forwards unexpected errors', async () => {
    const failure = new Error('db down');
    assertFeature.mockRejectedValue(failure);
    const res = mockRes();
    const next = vi.fn() as NextFunction;

    await requireEntitlement('recipes')(mockReq({ family_group_id: '4' }, fakeUser(3)), res, next);

    expect(next).toHaveBeenCalledWith(failure);
  });
});
