import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

const unauthorized = (res: Response): void => {
  res.setHeader('WWW-Authenticate', 'Basic realm="API Docs"');
  res.status(401).json({ message: 'Authentication required' });
};

const safeEqual = (left: string, right: string): boolean => {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);

  if (leftBuf.length !== rightBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuf, rightBuf);
};

/**
 * HTTP Basic Auth for Swagger UI (/api-docs).
 * Requires SWAGGER_USER and SWAGGER_PASSWORD. If either is unset, docs stay hidden (404).
 */
export const swaggerBasicAuth = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const expectedUser = process.env.SWAGGER_USER;
  const expectedPassword = process.env.SWAGGER_PASSWORD;

  if (!expectedUser || !expectedPassword) {
    res.status(404).json({ message: 'Not found' });
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Basic ')) {
    unauthorized(res);
    return;
  }

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
  } catch {
    unauthorized(res);
    return;
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) {
    unauthorized(res);
    return;
  }

  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (!safeEqual(username, expectedUser) || !safeEqual(password, expectedPassword)) {
    unauthorized(res);
    return;
  }

  next();
};
