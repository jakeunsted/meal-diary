import PostHog from 'posthog-react-native';

import { env } from '@/constants/env';
import type { User } from '@/types/api';

export const posthogClient: PostHog | null = env.posthogKey
  ? new PostHog(env.posthogKey, {
      host: env.posthogHost,
      captureAppLifecycleEvents: true,
    })
  : null;

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
}
