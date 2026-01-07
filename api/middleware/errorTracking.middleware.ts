import type { Request, Response, NextFunction } from 'express';
import { trackError } from '../utils/posthog.ts';

/**
 * Response interceptor middleware to track errors from responses
 * Tracks all API errors (4xx, 5xx) in PostHog
 */
export const errorTrackingMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Store original json and send methods
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalStatus = res.status.bind(res);

  let statusCode = res.statusCode || 200;

  // Override status to capture status code
  res.status = function(code: number) {
    statusCode = code;
    return originalStatus(code);
  };

  // Override json to track errors
  res.json = function(body: any) {
    if (statusCode >= 400) {
      const error = body?.message ? new Error(body.message) : new Error('API Error');
      trackError(req, error, statusCode, {
        response_body: typeof body === 'object' ? JSON.stringify(body) : String(body),
      }).catch(trackErr => {
        console.error('Error tracking API error:', trackErr);
      });
    }
    return originalJson(body);
  };

  // Override send to track errors
  res.send = function(body: any) {
    if (statusCode >= 400) {
      const error = typeof body === 'string' ? new Error(body) : new Error('API Error');
      trackError(req, error, statusCode).catch(trackErr => {
        console.error('Error tracking API error:', trackErr);
      });
    }
    return originalSend(body);
  };

  next();
};
