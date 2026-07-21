import type { FeatureFlagKey } from '@meal-diary/shared';
import { useEffect, useState } from 'react';

import { posthogClient } from '@/lib/analytics/posthog';

/**
 * Typed PostHog feature flag for Expo.
 * Fail-closed: false when the client is missing or the flag is unset.
 */
export function useFeatureFlag(flag: FeatureFlagKey): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const client = posthogClient;
    if (!client) {
      setEnabled(false);
      return;
    }

    const sync = () => {
      const value = client.getFeatureFlag(flag);
      setEnabled(value === true || value === 'true');
    };

    sync();
    return client.onFeatureFlags(sync);
  }, [flag]);

  return enabled;
}
