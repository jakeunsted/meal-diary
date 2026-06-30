import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

export const getPostHogClient = (apiKey: string, host: string): PostHog | null => {
  if (!apiKey) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(apiKey, {
      host,
      flushAt: 1,
      flushInterval: 10000,
    });
  }

  return posthogClient;
};

export const trackServerAuthEvent = async (
  apiKey: string,
  host: string,
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> => {
  const posthog = getPostHogClient(apiKey, host);
  if (!posthog || !distinctId) {
    return;
  }

  try {
    await posthog.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        source: 'frontend_server',
        category: 'auth',
      },
    });
    await posthog.flush();
  } catch (err) {
    console.error(`PostHog: Error capturing auth event "${event}":`, err instanceof Error ? err.message : err);
  }
};
