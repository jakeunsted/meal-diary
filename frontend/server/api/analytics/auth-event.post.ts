import { logAuthError } from '~/server/utils/otelLogs';

const ALLOWED_EVENTS = new Set([
  'oauth_login_redirect_error',
  'oauth_callback_client_error',
  'google_auth_client_error',
]);

const ALLOWED_PROPERTY_KEYS = new Set([
  'error_code',
  'error_type',
  'error_message',
  'path',
  'flow',
  'session_id',
]);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

const isRateLimited = (ip: string): boolean => {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > RATE_LIMIT_MAX;
};

const sanitizeProperties = (properties?: Record<string, unknown>): Record<string, unknown> => {
  if (!properties) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(properties)) {
    if (!ALLOWED_PROPERTY_KEYS.has(key)) {
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = typeof value === 'string' && value.length > 200
        ? `${value.slice(0, 200)}…`
        : value;
    }
  }
  return sanitized;
};

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  const apiKey = config.posthogKey as string;

  if (!apiKey) {
    return { ok: false };
  }

  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  if (isRateLimited(ip)) {
    throw createError({
      statusCode: 429,
      message: 'Too many requests',
    });
  }

  const body = await readBody(event);
  const eventName = body?.event as string | undefined;

  if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid event',
    });
  }

  const properties = sanitizeProperties(body?.properties as Record<string, unknown> | undefined);

  logAuthError(ip, eventName, {
    event: eventName,
    ...properties,
  });

  return { ok: true };
});
