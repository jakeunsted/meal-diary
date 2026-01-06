import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

/**
 * Get or create PostHog client instance
 */
export const getPostHog = (): PostHog | null => {
  if (!posthogClient && process.env.POSTHOG_KEY) {
    posthogClient = new PostHog(process.env.POSTHOG_KEY, {
      host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
      flushAt: 1,
      flushInterval: 10000 // Flush every 10 seconds
    });
  }
  return posthogClient;
};

/**
 * Track an event in PostHog
 * @param distinctId - User identifier (required for server-side events)
 * @param event - Event name
 * @param properties - Event properties
 */
export const trackEvent = async (
  distinctId: string,
  event: string,
  properties?: Record<string, any>
): Promise<void> => {
  const posthog = getPostHog();
  if (posthog && distinctId) {
    try {
      await posthog.capture({
        distinctId,
        event,
        properties: {
          ...properties,
          source: 'backend',
        },
      });
      // Explicitly flush to ensure event is sent immediately
      await posthog.flush();
    } catch (err) {
      console.error('Error capturing PostHog event:', err);
    }
  }
};

/**
 * Identify a user in PostHog
 * @param distinctId - User identifier
 * @param properties - User properties
 */
export const identifyUser = async (
  distinctId: string,
  properties?: Record<string, any>
): Promise<void> => {
  const posthog = getPostHog();
  if (posthog && distinctId) {
    try {
      await posthog.identify({
        distinctId,
        properties: {
          ...properties,
          source: 'backend',
        },
      });
      // Explicitly flush to ensure event is sent immediately
      await posthog.flush();
    } catch (err) {
      console.error('Error identifying user in PostHog:', err);
    }
  }
};

/**
 * Shutdown PostHog client (call on app shutdown)
 */
export const shutdownPostHog = async (): Promise<void> => {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
};

