import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../../services/entitlements.service.ts', () => ({
  resolveEntitlements: vi.fn(),
  dismissEntitlementPrompt: vi.fn(),
}));

import * as EntitlementsService from '../../services/entitlements.service.ts';
import {
  dismissEntitlementPrompt,
  getFamilyEntitlements,
} from '../entitlements/entitlements.controller.ts';

const mockResponse = () =>
  ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  }) as unknown as Response;

const mockRequest = (params: Record<string, string>, body: Record<string, unknown> = {}, userId?: number) =>
  ({
    params,
    body,
    user: userId === undefined ? undefined : { dataValues: { id: userId } },
  }) as unknown as Request;

describe('entitlements.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFamilyEntitlements', () => {
    it('returns entitlements for the signed-in user', async () => {
      const entitlements = { plan: 'free' };
      vi.mocked(EntitlementsService.resolveEntitlements).mockResolvedValue(entitlements as never);
      const res = mockResponse();

      await getFamilyEntitlements(mockRequest({ family_group_id: '4' }, {}, 7), res);

      expect(EntitlementsService.resolveEntitlements).toHaveBeenCalledWith(4, 7);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(entitlements);
    });

    it('returns 400 for a missing family group id and 401 without a user', async () => {
      const missingId = mockResponse();
      await getFamilyEntitlements(mockRequest({}, {}, 7), missingId);
      expect(missingId.status).toHaveBeenCalledWith(400);

      const missingUser = mockResponse();
      await getFamilyEntitlements(mockRequest({ id: '4' }), missingUser);
      expect(missingUser.status).toHaveBeenCalledWith(401);
    });

    it('returns 500 when entitlements cannot be loaded', async () => {
      vi.mocked(EntitlementsService.resolveEntitlements).mockRejectedValue(new Error('db'));
      const res = mockResponse();

      await getFamilyEntitlements(mockRequest({ family_group_id: '4' }, {}, 7), res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('dismissEntitlementPrompt', () => {
    it('dismisses a trial prompt and returns the refreshed entitlements', async () => {
      const entitlements = { plan: 'free' };
      vi.mocked(EntitlementsService.dismissEntitlementPrompt).mockResolvedValue(undefined as never);
      vi.mocked(EntitlementsService.resolveEntitlements).mockResolvedValue(entitlements as never);
      const res = mockResponse();

      await dismissEntitlementPrompt(
        mockRequest({ family_group_id: '4' }, { prompt: 'trial_expired' }, 7),
        res
      );

      expect(EntitlementsService.dismissEntitlementPrompt).toHaveBeenCalledWith(4, 7, 'trial_expired');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(entitlements);
    });

    it('rejects an unknown prompt and maps owner and not-found errors', async () => {
      const invalid = mockResponse();
      await dismissEntitlementPrompt(mockRequest({ family_group_id: '4' }, { prompt: 'other' }, 7), invalid);
      expect(invalid.status).toHaveBeenCalledWith(400);
      expect(invalid.json).toHaveBeenCalledWith({ message: 'Invalid prompt type' });

      vi.mocked(EntitlementsService.dismissEntitlementPrompt).mockRejectedValueOnce(
        new Error('Only the family owner can dismiss this')
      );
      const forbidden = mockResponse();
      await dismissEntitlementPrompt(
        mockRequest({ family_group_id: '4' }, { prompt: 'trial_expired' }, 7),
        forbidden
      );
      expect(forbidden.status).toHaveBeenCalledWith(403);

      vi.mocked(EntitlementsService.dismissEntitlementPrompt).mockRejectedValueOnce(
        new Error('Prompt not found')
      );
      const missing = mockResponse();
      await dismissEntitlementPrompt(
        mockRequest({ family_group_id: '4' }, { prompt: 'trial_expired' }, 7),
        missing
      );
      expect(missing.status).toHaveBeenCalledWith(404);
    });
  });
});
