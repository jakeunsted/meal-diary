import { describe, expect, it, vi } from 'vitest';
import { useAuthAnalytics } from './useAuthAnalytics';

describe('useAuthAnalytics', () => {
  it('posts auth failures from the client and drops empty properties', () => {
    const posted = vi.fn().mockResolvedValue({});
    vi.stubGlobal('$fetch', posted);
    globalThis.__NUXT_CLIENT__ = true;
    vi.stubGlobal('window', { posthog: { getSessionId: () => 'session-1' } });

    useAuthAnalytics().reportAuthError('login_failed', {
      error_message: 'nope',
      error_type: '',
    });

    expect(posted).toHaveBeenCalledWith('/api/analytics/auth-event', {
      method: 'POST',
      body: {
        event: 'login_failed',
        properties: { error_message: 'nope', session_id: 'session-1' },
      },
    });
  });

  it('does not report before the client is running', () => {
    const posted = vi.fn();
    vi.stubGlobal('$fetch', posted);
    useAuthAnalytics().reportAuthError('login_failed');
    expect(posted).not.toHaveBeenCalled();
  });
});
