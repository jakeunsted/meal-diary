import rateLimit from 'express-rate-limit';
import type { Options } from 'express-rate-limit';

// Function to create rate limiters with environment-based configuration
const createRateLimiter = (options: Options) => {
  const environment = process.env.NODE_ENV;
  if (environment === 'development') {
    // No rate limits in development environment
    return rateLimit({
      ...options,
      max: Infinity,
    });
  }
  return rateLimit(options);
};

// Rate limit for login attempts
export const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 5 attempts per window
  message: { message: 'Too many login attempts, please try again after 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
} as Options);

// Rate limit for logout
export const logoutLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 5 attempts per window
  message: { message: 'Too many logout attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
} as Options);

// Rate limit for token refresh
export const refreshTokenLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 60, // 60 attempts per 5 minutes per IP
  message: { message: 'Too many token refresh attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
} as Options);

// Rate limit for token validation
export const validateTokenLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { message: 'Too many token validation requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
} as Options);

// Rate limit for general API endpoints
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window
  message: { message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
} as Options); 
