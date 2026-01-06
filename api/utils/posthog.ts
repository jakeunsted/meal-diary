import { PostHog } from 'posthog-node';

let posthogClient: PostHog | null = null;

/**
 * Get or create PostHog client instance
 */
export const getPostHog = (): PostHog | null => {
  if (!posthogClient && process.env.POSTHOG_KEY) {
    posthogClient = new PostHog('hc_pPO4l7ghvIVDevpRKbW1WOOWQuhvTt4vpn8uV1DFuSN', {
      host: process.env.POSTHOG_HOST || 'https://eu.i.posthog.com',
      flushAt: 1,
      flushInterval: 0
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
export const trackEvent = (
  distinctId: string,
  event: string,
  properties?: Record<string, any>
): void => {
  const posthog = getPostHog();
  if (posthog && distinctId) {
    try {
      posthog.capture({
        distinctId,
        event,
        properties: {
          ...properties,
          source: 'backend',
        },
      });
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
export const identifyUser = (
  distinctId: string,
  properties?: Record<string, any>
): void => {
  const posthog = getPostHog();
  if (posthog && distinctId) {
    posthog.identify({
      distinctId,
      properties: {
        ...properties,
        source: 'backend',
      },
    });
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

