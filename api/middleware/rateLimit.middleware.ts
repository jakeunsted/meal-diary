import rateLimit from 'express-rate-limit';
import type { Options, RateLimitRequestHandler } from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import { trackEvent } from '../utils/posthog.ts';

// Function to create rate limiters with environment-based configuration
const createRateLimiter = (options: Options, limiterType: string): RateLimitRequestHandler => {
  const environment = process.env.NODE_ENV;
  if (environment === 'development') {
    // No rate limits in development environment
    return rateLimit({
      ...options,
      max: Infinity,
    });
  }
  
  // Add PostHog tracking when rate limit is exceeded
  // Using type assertion since onLimitReached may not be in type definitions
  const limiterOptions = {
    ...options,
    onLimitReached: (req: Request, res: Response) => {
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      trackEvent(ip, 'rate_limit_exceeded', {
        endpoint: req.path,
        method: req.method,
        ip,
        limiter_type: limiterType,
      }).catch(trackErr => {
        console.error('Error tracking rate limit event:', trackErr);
      });
    },
  } as Options & { onLimitReached?: (req: Request, res: Response) => void };
  
  return rateLimit(limiterOptions);
};

// Rate limit for login attempts
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 5 attempts per window
  message: { message: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
} as Options, 'login');

// Rate limit for logout
export const logoutLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 5 attempts per window
  message: { message: 'Too many logout attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
} as Options, 'logout');

// Rate limit for token refresh
export const refreshTokenLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60, // 60 attempts per 5 minutes per IP
  message: { message: 'Too many token refresh attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
} as Options, 'refresh');

// Rate limit for token validation
export const validateTokenLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { message: 'Too many token validation requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
} as Options, 'validate');

// Rate limit for general API endpoints
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
} as Options, 'api'); 
