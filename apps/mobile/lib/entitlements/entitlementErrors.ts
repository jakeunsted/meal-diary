import type { EntitlementFeature } from '@meal-diary/shared';

import { ApiError } from '@/lib/api/client';

export function getEntitlementFeatureFromError(error: unknown): EntitlementFeature | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  if (error.code !== 'ENTITLEMENT_REQUIRED' || !error.feature) {
    return null;
  }

  return error.feature as EntitlementFeature;
}
