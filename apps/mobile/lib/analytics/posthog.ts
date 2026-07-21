import PostHog from 'posthog-react-native';

import { env } from '@/constants/env';
import type { User } from '@/types/api';

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export const posthogClient: PostHog | null = env.posthogKey
  ? new PostHog(env.posthogKey, {
      host: env.posthogHost,
      // Keep lifecycle analytics off in local/dev; flags still preload
      captureAppLifecycleEvents: !isDev,
    })
  : null;

if (posthogClient && isDev) {
  void posthogClient.optOut();
}

export function identifyUser(user: User): void {
  if (!posthogClient || !user?.id) {
    return;
  }

  const firstName = user.first_name ?? '';
  const lastName = user.last_name ?? '';
  const name = `${firstName} ${lastName}`.trim();

  posthogClient.identify(String(user.id), {
    email: user.email,
    ...(name ? { name } : {}),
  });
}

export function resetAnalytics(): void {
  posthogClient?.reset();
  // reset() clears opt-out; re-apply in local/dev so capture stays off
  if (posthogClient && isDev) {
    void posthogClient.optOut();
  }
}
