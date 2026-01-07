import { PostHog } from 'posthog-node';
import type { Request } from 'express';

let posthogClient: PostHog | null = null;

/**
 * Get or create PostHog client instance
 */
export const getPostHog = (): PostHog | null => {
  if (!posthogClient) {
    if (!process.env.POSTHOG_KEY) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('PostHog: POSTHOG_KEY environment variable not set');
      }
      return null;
    }

    const host = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';
    
    try {
      posthogClient = new PostHog(process.env.POSTHOG_KEY, {
        host,
        flushAt: 1,
        flushInterval: 10000, // Flush every 10 seconds
      });

      if (process.env.NODE_ENV !== 'production') {
        console.log(`PostHog: Client initialized with host ${host}`);
      }
    } catch (err) {
      console.error('PostHog: Failed to initialize client:', err);
      return null;
    }
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
  // Log that trackEvent was called (helps debug if events aren't reaching PostHog)
  if (process.env.NODE_ENV === 'production') {
    console.log(`PostHog: trackEvent called for "${event}" (user: ${distinctId})`);
  }

  const posthog = getPostHog();
  if (!posthog) {
    console.warn(`PostHog: Skipping event "${event}" - client not initialized`);
    return;
  }

  if (!distinctId) {
    console.warn(`PostHog: Skipping event "${event}" - missing distinctId`);
    return;
  }

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
    
    // Log in production too (but less verbose) to verify events are being sent
    if (process.env.NODE_ENV === 'production') {
      console.log(`PostHog: Event "${event}" sent for user ${distinctId}`);
    } else {
      console.log(`PostHog: Event "${event}" captured for user ${distinctId}`);
    }
  } catch (err) {
    // Log detailed error for debugging Railway issues - always log errors
    const errorMessage = err instanceof Error ? err.message : String(err);
    const errorStack = err instanceof Error ? err.stack : undefined;
    console.error(`PostHog: Error capturing event "${event}":`, {
      error: errorMessage,
      stack: errorStack,
      distinctId,
      event,
      // Don't log full properties to avoid sensitive data
      hasProperties: !!properties,
    });
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
 * Get distinct ID from request (user ID or IP address)
 * @param req - Express request object
 * @returns distinct ID string
 */
export const getDistinctId = (req: Request): string => {
  // Try to get user ID if authenticated
  if (req.user && (req.user as any).dataValues?.id) {
    return (req.user as any).dataValues.id.toString();
  }
  if (req.user && (req.user as any).id) {
    return (req.user as any).id.toString();
  }
  
  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return ip;
};

/**
 * Track an error event in PostHog
 * @param req - Express request object
 * @param error - Error object
 * @param statusCode - HTTP status code
 * @param additionalProperties - Additional properties to include
 */
export const trackError = async (
  req: Request,
  error: Error | unknown,
  statusCode: number,
  additionalProperties?: Record<string, any>
): Promise<void> => {
  const distinctId = getDistinctId(req);
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorStack = error instanceof Error ? error.stack : undefined;
  
  await trackEvent(distinctId, 'api_error', {
    status_code: statusCode,
    path: req.path,
    method: req.method,
    error_message: errorMessage,
    error_stack: errorStack,
    user_id: req.user ? getDistinctId(req) : undefined,
    ...additionalProperties,
  });
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

