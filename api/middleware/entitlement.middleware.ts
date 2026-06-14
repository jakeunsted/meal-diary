import type { NextFunction, Request, Response } from 'express';
import type { EntitlementFeature } from '../constants/entitlementFeatures.ts';
import {
  assertFeature,
  EntitlementRequiredError,
  type ResolvedEntitlements,
} from '../services/entitlements.service.ts';
import type User from '../db/models/User.model.ts';

declare global {
  namespace Express {
    interface Request {
      entitlements?: ResolvedEntitlements;
    }
  }
}

const parseFamilyGroupId = (req: Request): number | null => {
  const raw = req.params.family_group_id ?? req.params.id;
  const familyGroupId = parseInt(raw ?? '', 10);
  return Number.isNaN(familyGroupId) ? null : familyGroupId;
};

export const handleEntitlementError = (error: unknown, res: Response): boolean => {
  if (error instanceof EntitlementRequiredError) {
    res.status(403).json({
      code: error.code,
      feature: error.feature,
      plan: error.plan,
      upgradeUrl: '/plans',
    });
    return true;
  }

  return false;
};

export const requireEntitlement = (feature: EntitlementFeature) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const familyGroupId = parseFamilyGroupId(req);
      const user = req.user as User | undefined;

      if (!familyGroupId) {
        res.status(400).json({ message: 'Invalid family group ID' });
        return;
      }

      if (!user) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
      }

      req.entitlements = await assertFeature(
        familyGroupId,
        user.dataValues.id,
        feature
      );
      next();
    } catch (error) {
      if (handleEntitlementError(error, res)) {
        return;
      }
      next(error);
    }
  };
