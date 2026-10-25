import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
}

const rateLimitMock = vi.hoisted(() => vi.fn((_options: CapturedLimiterOptions) => vi.fn()));

vi.mock('express-rate-limit', () => ({
  default: (options: CapturedLimiterOptions) => rateLimitMock(options),
}));

vi.mock('../../utils/posthog.ts', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
}));

const originalNodeEnv = process.env.NODE_ENV;

const mockReq = (path: string): Request => ({
  path,
  method: 'GET',
  ip: '203.0.113.5',
  socket: { remoteAddress: '203.0.113.5' },
}) as Request;

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
