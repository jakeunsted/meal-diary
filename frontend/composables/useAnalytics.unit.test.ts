import { describe, expect, it, vi } from 'vitest';
import { useAnalytics } from './useAnalytics';

describe('useAnalytics', () => {
  it('does nothing off the client and forwards events when PostHog is available', () => {
    const { track } = useAnalytics();
    track('meal_saved', { id: '1' });

    globalThis.__NUXT_CLIENT__ = true;
    const capture = vi.fn();
    vi.stubGlobal('useNuxtApp', () => ({ $posthog: { track: capture } }));
    track('meal_saved', { id: '1' });
    expect(capture).toHaveBeenCalledWith('meal_saved', { id: '1' });

    vi.stubGlobal('useNuxtApp', () => {
      throw new Error('nuxt unavailable');
    });
    expect(() => track('meal_saved')).not.toThrow();
  });
});
