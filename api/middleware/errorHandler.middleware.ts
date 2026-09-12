import type { ErrorRequestHandler } from 'express';
import { emitLog } from '../utils/otelLogs.ts';

/**
 * Express error middleware for unhandled `next(err)` / rejected route promises.
 * Emits a PostHog Log then returns JSON. Existing console.error stays alongside.
 */
export const errorHandlerMiddleware: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  const status = typeof err?.status === 'number'
    ? err.status
    : typeof err?.statusCode === 'number'
      ? err.statusCode
      : 500;

  const message = err instanceof Error
    ? err.message
    : typeof err?.message === 'string'
      ? err.message
      : 'Unhandled API error';

  emitLog({
    severity: status >= 500 ? 'error' : 'warn',
    body: message,
    req,
    attributes: {
      category: 'http',
      path: req.path,
      method: req.method,
      status,
    },
  });

  console.error('Unhandled API error:', err);

  res.status(status).json({
    message: status >= 500 ? 'Server error' : message,
  });
};
