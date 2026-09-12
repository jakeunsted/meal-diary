import type { NextFunction, Request, Response } from 'express';
import { emitLog } from '../utils/otelLogs.ts';

/**
 * Wraps res.json / res.send so swallowed controller 5xx responses reach PostHog Logs.
 * Register before routes. Does not touch 4xx or analytics event capture.
 */
export const serverErrorLogMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);
  const originalStatus = res.status.bind(res);

  let statusCode = res.statusCode || 200;
  let logged = false;

  res.status = function(code: number) {
    statusCode = code;
    return originalStatus(code);
  };

  const logServerError = (): void => {
    if (logged || statusCode < 500) {
      return;
    }
    logged = true;
    emitLog({
      severity: 'error',
      body: 'API server error',
      req,
      attributes: {
        category: 'http',
        path: req.path,
        method: req.method,
        status: statusCode,
      },
    });
  };

  res.json = function(body: any) {
    logServerError();
    return originalJson(body);
  };

  res.send = function(body: any) {
    logServerError();
    return originalSend(body);
  };

  next();
};
