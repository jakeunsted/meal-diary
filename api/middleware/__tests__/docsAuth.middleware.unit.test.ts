import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { swaggerBasicAuth } from '../docsAuth.middleware.ts';

const mockRes = () => {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader: vi.fn((key: string, value: string) => {
      res.headers[key] = value;
    }),
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((payload: unknown) => {
      res.body = payload;
      return res;
    }),
  };
  return res as unknown as Response & {
    statusCode: number;
    body: unknown;
    headers: Record<string, string>;
  };
};

describe('swaggerBasicAuth', () => {
  const originalUser = process.env.SWAGGER_USER;
  const originalPassword = process.env.SWAGGER_PASSWORD;

  beforeEach(() => {
    delete process.env.SWAGGER_USER;
    delete process.env.SWAGGER_PASSWORD;
  });

  afterEach(() => {
    if (originalUser === undefined) {
      delete process.env.SWAGGER_USER;
    } else {
      process.env.SWAGGER_USER = originalUser;
    }
    if (originalPassword === undefined) {
      delete process.env.SWAGGER_PASSWORD;
    } else {
      process.env.SWAGGER_PASSWORD = originalPassword;
    }
  });

  it('returns 404 when credentials are not configured', () => {
    const next = vi.fn();
    const res = mockRes();

    swaggerBasicAuth({ headers: {} } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('challenges when Authorization is missing', () => {
    process.env.SWAGGER_USER = 'docs';
    process.env.SWAGGER_PASSWORD = 'secret';
    const next = vi.fn();
    const res = mockRes();

    swaggerBasicAuth({ headers: {} } as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.setHeader).toHaveBeenCalledWith('WWW-Authenticate', 'Basic realm="API Docs"');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects invalid credentials', () => {
    process.env.SWAGGER_USER = 'docs';
    process.env.SWAGGER_PASSWORD = 'secret';
    const next = vi.fn();
    const res = mockRes();
    const auth = Buffer.from('docs:wrong').toString('base64');

    swaggerBasicAuth(
      { headers: { authorization: `Basic ${auth}` } } as Request,
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next for valid credentials', () => {
    process.env.SWAGGER_USER = 'docs';
    process.env.SWAGGER_PASSWORD = 'secret';
    const next = vi.fn();
    const res = mockRes();
    const auth = Buffer.from('docs:secret').toString('base64');

    swaggerBasicAuth(
      { headers: { authorization: `Basic ${auth}` } } as Request,
      res,
      next
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
