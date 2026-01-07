import { PostHog } from 'posthog-node';
import type { Request } from 'express';

let posthogClient: PostHog | null = null;

/**
 * Get or create PostHog client instance
 */
export const getPostHog = (): PostHog | null => {
  if (!posthogClient) {
    if (!process.env.POSTHOG_KEY) {
      return null;
    }

    const host = process.env.POSTHOG_HOST || 'https://eu.i.posthog.com';
    
    try {
      posthogClient = new PostHog(process.env.POSTHOG_KEY, {
        host,
        flushAt: 1,
        flushInterval: 10000, // Flush every 10 seconds
      });
    } catch (err) {
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
  const posthog = getPostHog();
  if (!posthog) {
    return;
  }

  if (!distinctId) {
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
  } catch (err) {
    // Silently fail - don't log PostHog errors
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
      // Silently fail - don't log PostHog errors
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

