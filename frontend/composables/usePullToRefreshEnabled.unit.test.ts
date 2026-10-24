import { describe, expect, it, vi } from 'vitest';
import { usePullToRefreshEnabled } from './usePullToRefreshEnabled';

describe('usePullToRefreshEnabled', () => {
  it('stays off away from the client', () => {
    expect(usePullToRefreshEnabled().pullToRefreshEnabled.value).toBe(false);
  });

  it('follows a narrow viewport', () => {
    const listeners: Array<() => void> = [];
    const media = {
      matches: true,
      addEventListener: (_event: string, listener: () => void) => listeners.push(listener),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('window', { matchMedia: () => media });
    globalThis.__NUXT_CLIENT__ = true;

    const enabled = usePullToRefreshEnabled();
    flushMounted();
    expect(enabled.pullToRefreshEnabled.value).toBe(true);

    media.matches = false;
    listeners[0]();
    expect(enabled.pullToRefreshEnabled.value).toBe(false);

    flushUnmounted();
    expect(media.removeEventListener).toHaveBeenCalled();
  });
});
