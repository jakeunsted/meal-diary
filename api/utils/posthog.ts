import { PostHog } from 'posthog-node';
import axios from 'axios';
import type { Request } from 'express';

let posthogClient: PostHog | null = null;

const MAX_ERROR_MESSAGE_LENGTH = 200;

export interface SanitizedError {
  error_message: string;
  error_type: string;
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

const SENSITIVE_PATTERNS = [
  /Bearer\s+[^\s]+/gi,
  /accessToken[=:][^\s&]+/gi,
  /refreshToken[=:][^\s&]+/gi,
  /authorization_code[=:][^\s&]+/gi,
  /idToken[=:][^\s&]+/gi,
  /id_token[=:][^\s&]+/gi,
  /\bcode=[^\s&]+/gi,
];

/**
 * Redact PII and secrets from error text before sending to PostHog.
 * Filter PostHog by google_oauth_callback_failure + time window + IP to debug auth incidents.
 */
const redactSensitiveText = (text: string): string => {
  let result = text.replace(EMAIL_REGEX, '[email]');
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, '[redacted]');
  }
  if (result.length > MAX_ERROR_MESSAGE_LENGTH) {
    return `${result.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…`;
  }
  return result;
};

const extractErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; error_description?: string } | undefined;
    if (data?.error_description) {
      return `${data.error ?? 'error'}: ${data.error_description}`;
    }
    if (data?.error) {
      return String(data.error);
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message: unknown }).message);
  }

  return String(error);
};

const classifyErrorType = (message: string, errorName?: string): string => {
  const lower = message.toLowerCase();

  if (lower.includes('invalid_grant') || lower.includes('redirect_uri_mismatch')) {
    return 'token_exchange';
  }
  if (message.includes('No email in Google profile') || lower.includes('no email in google profile')) {
    return 'no_email';
  }
  if (
    errorName === 'SequelizeValidationError' ||
    errorName === 'SequelizeUniqueConstraintError' ||
    lower.includes('unique violation') ||
    lower.includes('validation error')
  ) {
    return 'db_error';
  }
  if (lower.includes('jwt secrets not configured')) {
    return 'jwt_error';
  }
  if (lower.includes('invalid token') || lower.includes('token audience')) {
    return 'invalid_token';
  }
  if (lower.includes('oauth credentials not configured')) {
    return 'token_exchange';
  }

  return 'unknown';
};

export const sanitizeErrorForAnalytics = (error: unknown): SanitizedError => {
  const rawMessage = extractErrorMessage(error);
  const errorName = error instanceof Error ? error.name : undefined;

  return {
    error_message: redactSensitiveText(rawMessage),
    error_type: classifyErrorType(rawMessage, errorName),
  };
};

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
 * Track an auth-related event in PostHog
 */
export const trackAuthLog = async (
  req: Request,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> => {
  await trackEvent(getDistinctId(req), event, {
    ...properties,
    category: 'auth',
  });
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
 * Delete a person and all their events from PostHog (GDPR erasure on
 * account deletion). Uses the private API, which needs a personal API key
 * (POSTHOG_PERSONAL_API_KEY) and project id (POSTHOG_PROJECT_ID) — distinct
 * from the ingestion key. No-ops with a warning when they are not set.
 */
export const deletePersonData = async (distinctId: string): Promise<void> => {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  const projectId = process.env.POSTHOG_PROJECT_ID;
  // The private API lives on the app host, not the ingestion (*.i.*) host
  const host = (process.env.POSTHOG_HOST || 'https://eu.i.posthog.com').replace('.i.posthog.com', '.posthog.com');

  if (!apiKey || !projectId) {
    console.warn(`PostHog: Skipping person deletion for ${distinctId} - POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID not set`);
    return;
  }

  try {
    const headers = { Authorization: `Bearer ${apiKey}` };
    const search = await axios.get(`${host}/api/projects/${projectId}/persons/`, {
      headers,
      params: { distinct_id: distinctId },
    });

    const persons: Array<{ id: string }> = search.data?.results ?? [];
    for (const person of persons) {
      await axios.delete(`${host}/api/projects/${projectId}/persons/${person.id}/`, {
        headers,
        params: { delete_events: 'true' },
      });
    }
    console.log(`PostHog: Deleted ${persons.length} person record(s) for user ${distinctId}`);
  } catch (err) {
    console.error(`PostHog: Failed to delete person data for ${distinctId}:`, err instanceof Error ? err.message : err);
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

