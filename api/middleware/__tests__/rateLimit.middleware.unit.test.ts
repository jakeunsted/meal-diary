import http from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import type { Request } from 'express';

interface RateLimitResponseMock {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

interface CapturedLimiterOptions {
  handler?: (
    req: Request,
    res: RateLimitResponseMock,
    next: unknown,
    handlerOptions: { statusCode: number; message: unknown },
  ) => void;
  keyGenerator?: (req: Request) => string | Promise<string>;
}

const rateLimitMock = vi.hoisted(() => vi.fn((_options: CapturedLimiterOptions) => vi.fn()));

vi.mock('express-rate-limit', async () => {
  const actual = await vi.importActual<typeof import('express-rate-limit')>('express-rate-limit');
  return {
    ...actual,
    default: (options: CapturedLimiterOptions) => rateLimitMock(options),
  };
});

vi.mock('../../utils/posthog.ts', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

const originalNodeEnv = process.env.NODE_ENV;

const mockReq = (path: string): Request => ({
  path,
  method: 'GET',
  ip: '198.51.100.20',
  headers: { 'x-forwarded-for': '198.51.100.20' },
  socket: { remoteAddress: '203.0.113.5' },
}) as unknown as Request;

const mockRes = (): RateLimitResponseMock => {
  const res = {
    status: vi.fn(() => res),
    send: vi.fn(() => res),
  };
  return res;
};

const loadLimiters = async () => {
  vi.resetModules();
  rateLimitMock.mockClear();
  process.env.NODE_ENV = 'production';
  const posthog = await import('../../utils/posthog.ts');
  const middleware = await import('../rateLimit.middleware.ts');
  vi.mocked(posthog.trackEvent).mockClear();
  const options = rateLimitMock.mock.calls.map((call) => call[0]);
  return {
    shouldTrackRateLimitDenial: middleware.shouldTrackRateLimitDenial,
    rateLimitClientKey: middleware.rateLimitClientKey,
    trackEvent: posthog.trackEvent,
    options,
  };
};

describe('shouldTrackRateLimitDenial', () => {
  beforeEach(() => {
    rateLimitMock.mockClear();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('skips scanner paths that are not product routes', async () => {
    const { shouldTrackRateLimitDenial } = await loadLimiters();
    const probePaths = [
      '/',
      '/.env',
      '/.env.local',
      '/@fs/proc/self/environ',
      '/id_rsa',
      '/.svn/entries',
      '/%2f%2egithub/issue_template',
      '/login',
      '/api/v1/validate/code',
      '/.aws/credentials',
    ];

    for (const path of probePaths) {
      expect(shouldTrackRateLimitDenial(path)).toBe(false);
    }
  });

  it('skips secret-file and wildcard probes mounted under a real prefix', async () => {
    const { shouldTrackRateLimitDenial } = await loadLimiters();

    expect(shouldTrackRateLimitDenial('/internal/.env')).toBe(false);
    expect(shouldTrackRateLimitDenial('/auth/.env')).toBe(false);
    expect(shouldTrackRateLimitDenial('/auth/*')).toBe(false);
    expect(shouldTrackRateLimitDenial('/billing/*')).toBe(false);
    expect(shouldTrackRateLimitDenial('/auth/id_rsa')).toBe(false);
    expect(shouldTrackRateLimitDenial('/users/%2e%2e/.env')).toBe(false);
  });

  it('keeps denials on real API routes', async () => {
    const { shouldTrackRateLimitDenial } = await loadLimiters();
    const productPaths = [
      '/auth/login',
      '/auth/refresh-token',
      '/users/4',
      '/meal-diaries/1',
      '/family-groups/join',
      '/shopping-list/1',
      '/recipes/import-from-url',
      '/billing/create-portal-session',
      '/sse/1',
      '/health',
      '/internal/slow-query-webhook-test',
      '/api-docs',
    ];

    for (const path of productPaths) {
      expect(shouldTrackRateLimitDenial(path)).toBe(true);
    }
  });
});

describe('rate limit handler', () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('still returns the denial without sending probe telemetry', async () => {
    const { options, trackEvent } = await loadLimiters();
    const handlerOptions = { statusCode: 429, message: { message: 'Too many requests, please try again later' } };

    expect(options.length).toBeGreaterThan(0);
    for (const limiter of options) {
      expect(limiter.handler).toEqual(expect.any(Function));
      const res = mockRes();
      limiter.handler!(mockReq('/.env'), res, vi.fn(), handlerOptions);
      expect(res.status).toHaveBeenCalledWith(429);
      expect(res.send).toHaveBeenCalledWith(handlerOptions.message);
    }

    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('records a denial on a product route', async () => {
    const { options, trackEvent } = await loadLimiters();
    const apiLimiter = options.at(-1);
    const res = mockRes();
    const handlerOptions = { statusCode: 429, message: { message: 'Too many requests, please try again later' } };

    apiLimiter?.handler!(mockReq('/auth/login'), res, vi.fn(), handlerOptions);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(trackEvent).toHaveBeenCalledWith('203.0.113.5', 'rate_limit_exceeded', {
      endpoint: '/auth/login',
      method: 'GET',
      ip: '203.0.113.5',
      limiter_type: 'api',
    });
  });
});

describe('rateLimitClientKey', () => {
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('gives direct connections one key when only X-Forwarded-For changes', async () => {
    const { rateLimitClientKey } = await loadLimiters();
    const app = express();
    app.set('trust proxy', 1);
    const seen: { ip: string | undefined; key: string }[] = [];
    app.get('/', (req, res) => {
      seen.push({ ip: req.ip, key: rateLimitClientKey(req) });
      res.status(204).end();
    });

    const server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    try {
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('expected a TCP port');
      }
      const send = (forwardedFor: string, realIp?: string) => fetch(`http://127.0.0.1:${address.port}/`, {
        headers: {
          'X-Forwarded-For': forwardedFor,
          ...(realIp ? { 'X-Real-IP': realIp } : {}),
        },
      });

      await send('203.0.113.10');
      await send('203.0.113.11');
      await send('203.0.113.12', '198.51.100.8');
      await send('203.0.113.13', '198.51.100.8, 198.51.100.9');

      expect(seen.map((entry) => entry.ip)).toEqual([
        '203.0.113.10',
        '203.0.113.11',
        '203.0.113.12',
        '203.0.113.13',
      ]);
      expect(seen[0]?.key).toBe('127.0.0.1');
      expect(seen[1]?.key).toBe('127.0.0.1');
      expect(seen[2]?.key).toBe('198.51.100.8');
      expect(seen[3]?.key).toBe('127.0.0.1');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  it('installs that key on every limiter', async () => {
    const { options, rateLimitClientKey } = await loadLimiters();
    const req = mockReq('/auth/login');

    expect(options.length).toBeGreaterThan(0);
    for (const limiter of options) {
      expect(await limiter.keyGenerator?.(req)).toBe(rateLimitClientKey(req));
    }
    expect(rateLimitClientKey(req)).toBe('203.0.113.5');
  });
});
