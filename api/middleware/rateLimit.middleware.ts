import rateLimit from 'express-rate-limit';
import type { Options, RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response } from 'express';
import { trackEvent } from '../utils/posthog.ts';

// Keep aligned with the routers mounted in index.ts. Scanner traffic hits the
// global limiter on paths this API does not serve, and those denials were
// flooding PostHog. Secret-file probes under a real prefix are skipped too.
const PRODUCT_ROUTE_PREFIXES = [
  '/users',
  '/meal-diaries',
  '/family-groups',
  '/shopping-list',
  '/auth',
  '/recipes',
  '/billing',
  '/sse',
  '/health',
  '/internal',
  '/api-docs',
];

const PROBE_PATH_PATTERN = /(?:^|\/)\.|%2e|%2f|\.\.|\*|id_rsa|id_ecdsa|proc\/self/i;

export const shouldTrackRateLimitDenial = (path: string): boolean => {
  const matchesProductRoute = PRODUCT_ROUTE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );

  if (!matchesProductRoute) {
    return false;
  }

  return !PROBE_PATH_PATTERN.test(path);
};

const trackRateLimitDenial = (req: Request, limiterType: string): void => {
  if (!shouldTrackRateLimitDenial(req.path)) {
    return;
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  trackEvent(ip, 'rate_limit_exceeded', {
    endpoint: req.path,
    method: req.method,
    ip,
    limiter_type: limiterType,
  }).catch(trackErr => {
    console.error('Error tracking rate limit event:', trackErr);
  });
};

// Function to create rate limiters with environment-based configuration
const createRateLimiter = (options: Partial<Options>, limiterType: string): RateLimitRequestHandler => {
  const environment = process.env.NODE_ENV;
  if (environment === 'development') {
    // No rate limits in development environment
    return rateLimit({
      ...options,
      limit: Number.MAX_SAFE_INTEGER,
    });
  }
  
  return rateLimit({
    ...options,
    handler: (req: Request, res: Response, _next, handlerOptions) => {
      trackRateLimitDenial(req, limiterType);
      res.status(handlerOptions.statusCode).send(handlerOptions.message);
    },
  });
};

// Rate limit for login attempts
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 5 attempts per window
  message: { message: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
}, 'login');

// Rate limit for password reset requests
export const passwordResetLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 5,
  message: { message: 'Too many password reset attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
}, 'password_reset');

// Rate limit for logout
export const logoutLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 20, // 5 attempts per window
  message: { message: 'Too many logout attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
}, 'logout');

// Rate limit for token refresh
export const refreshTokenLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  limit: 60, // 60 attempts per 5 minutes per IP
  message: { message: 'Too many token refresh attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
}, 'refresh');

// Rate limit for token validation
export const validateTokenLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  limit: 30, // 30 requests per minute
  message: { message: 'Too many token validation requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
}, 'validate');

// Rate limit for general API endpoints
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200, // 200 requests per window
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
}, 'api'); 
