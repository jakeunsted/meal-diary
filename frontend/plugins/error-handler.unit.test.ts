import { describe, expect, it, vi } from 'vitest';

const handleAutoLogout = vi.hoisted(() => vi.fn());

vi.mock('~/composables/useAuth', () => ({
  handleAutoLogout,
}));

import plugin from './error-handler';

describe('error-handler plugin', () => {
  it('reports an unhandled rejection and logs out when the session expired', async () => {
    const listeners = new Map<string, (event: PromiseRejectionEvent) => void>();
    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: (event: PromiseRejectionEvent) => void) => {
        listeners.set(type, listener);
      },
    });
    (process as NodeJS.Process & { client?: boolean }).client = true;
    const logger = { error: vi.fn() };
    const nuxtApp = { $posthog: { logger } };

    plugin(nuxtApp as never);
    const event = {
      reason: new Error('invalid or expired refresh token'),
      preventDefault: vi.fn(),
    };
    await listeners.get('unhandledrejection')?.(event as unknown as PromiseRejectionEvent);

    expect(logger.error).toHaveBeenCalledWith('Unhandled promise rejection', {
      reason: 'invalid or expired refresh token',
    });
    expect(event.preventDefault).toHaveBeenCalled();
    expect(handleAutoLogout).toHaveBeenCalled();
  });
});
