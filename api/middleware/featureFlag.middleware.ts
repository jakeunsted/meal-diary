import type { NextFunction, Request, Response } from 'express';
import type { FeatureFlagKey } from '@meal-diary/shared';
import { getDistinctId, isFeatureEnabled } from '../utils/posthog.ts';

/**
 * Gate a route behind a PostHog feature flag.
 * Fail-closed: responds 404 when the flag is off or PostHog is unavailable.
 * Not applied to any routes by default — attach where needed.
 */
export const requireFeatureFlag = (flag: FeatureFlagKey) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const distinctId = getDistinctId(req);
      const enabled = await isFeatureEnabled(distinctId, flag);
      if (!enabled) {
        res.status(404).json({ message: 'Not found' });
        return;
      }
      next();
    } catch (error) {
      next(error);
    }
  };
