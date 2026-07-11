import type { NextFunction, Request, Response } from 'express';

const defaultDevOrigins = [
  'http://localhost:3002',
  'http://127.0.0.1:3002',
  'http://dev-app.mealdiary.co.uk',
  'https://dev-app.mealdiary.co.uk',
  'http://localhost:19006',
  'http://127.0.0.1:19006',
];

function getAllowedOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean);
  return fromEnv?.length ? fromEnv : defaultDevOrigins;
}

/** Allow browser clients (e.g. Expo web) to call the API directly in development. */
export function devCorsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
}
