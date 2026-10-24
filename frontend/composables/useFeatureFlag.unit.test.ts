import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURE_FLAGS } from '@meal-diary/shared';

const posthog = vi.hoisted(() => ({
  getFeatureFlag: vi.fn(),
  onFeatureFlags: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: posthog,
}));

import { useFeatureFlag } from './useFeatureFlag';

describe('useFeatureFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
    });
  });

  it('stays closed until the client can read PostHog', () => {
    const flag = useFeatureFlag(FEATURE_FLAGS.featureFlagsEnabled);
    expect(flag.ready.value).toBe(false);
    expect(flag.enabled.value).toBe(false);
  });

  it('syncs a flag and unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    posthog.getFeatureFlag.mockReturnValue(true);
    posthog.onFeatureFlags.mockReturnValue(unsubscribe);
    globalThis.__NUXT_CLIENT__ = true;

    const flag = useFeatureFlag(FEATURE_FLAGS.featureFlagsEnabled);
    flushMounted();

    expect(flag.enabled.value).toBe(true);
    expect(flag.value.value).toBe(true);
    expect(flag.ready.value).toBe(true);

    flushUnmounted();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('fails closed when PostHog throws', () => {
    posthog.getFeatureFlag.mockImplementation(() => {
      throw new Error('down');
    });
    posthog.onFeatureFlags.mockImplementation(() => {
      throw new Error('down');
    });
    globalThis.__NUXT_CLIENT__ = true;

    const flag = useFeatureFlag(FEATURE_FLAGS.featureFlagsEnabled);
    flushMounted();

    expect(flag.enabled.value).toBe(false);
    expect(flag.ready.value).toBe(true);
  });
});
