import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

import { Capacitor } from '@capacitor/core';
import { usePullToRefreshEnabled } from './usePullToRefreshEnabled';

describe('usePullToRefreshEnabled', () => {
  it('stays off away from the client', () => {
    expect(usePullToRefreshEnabled().pullToRefreshEnabled.value).toBe(false);
  });

  it('turns on for a narrow viewport or a native app', () => {
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

    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    listeners[0]();
    expect(enabled.pullToRefreshEnabled.value).toBe(true);

    flushUnmounted();
    expect(media.removeEventListener).toHaveBeenCalled();
  });
});
