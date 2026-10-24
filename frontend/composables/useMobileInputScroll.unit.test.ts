import { describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));

import { useMobileInputScroll } from './useMobileInputScroll';

describe('useMobileInputScroll', () => {
  it('scrolls the nearest parent when the Android keyboard covers an input', async () => {
    vi.useFakeTimers();
    const parent = { scrollTop: 0, parentElement: null as HTMLElement | null };
    const element = {
      parentElement: parent,
      getBoundingClientRect: () => ({ bottom: 700 }),
      scrollIntoView: vi.fn(),
    };
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Linux; Android 14)' });
    vi.stubGlobal('window', {
      innerHeight: 800,
      getComputedStyle: () => ({ overflow: 'auto', overflowY: '', overflowX: '' }),
      scrollBy: vi.fn(),
      addEventListener: vi.fn(),
    });

    useMobileInputScroll().scrollToInput(element as unknown as HTMLElement);
    await vi.advanceTimersByTimeAsync(700);

    expect(parent.scrollTop).toBeGreaterThan(0);
    expect(element.scrollIntoView).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
