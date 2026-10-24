import { nextTick } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  opt_out_capturing: vi.fn(),
  opt_in_capturing: vi.fn(),
  identify: vi.fn(),
  reset: vi.fn(),
  capture: vi.fn(),
  isFeatureEnabled: vi.fn(() => true),
  getFeatureFlag: vi.fn(() => 'variant'),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const consent = vi.hoisted(() => ({
  current: null as { value: boolean | null } | null,
}));

vi.mock('posthog-js', () => ({ default: posthog }));

vi.mock('~/stores/auth', () => ({
  useAuthStore: () => ({
    user: { id: 3, email: 'ada@example.com', first_name: 'Ada', last_name: 'Lovelace' },
  }),
}));

vi.mock('~/composables/useAnalyticsConsent', async () => {
  const { computed: vueComputed, ref: vueRef } = await import('vue');
  const analyticsConsent = vueRef<boolean | null>(null);
  consent.current = analyticsConsent;
  return {
    useAnalyticsConsent: () => ({
      analyticsConsent,
      hasAnalyticsConsent: vueComputed(() => analyticsConsent.value === true),
      loadConsent: async () => analyticsConsent.value,
    }),
  };
});

import plugin from './analytics.client';

describe('analytics plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (consent.current) consent.current.value = null;
  });

  it('provides a no-op client away from the browser', () => {
    const provided: Record<string, { isFeatureEnabled: () => boolean }> = {};
    plugin({ provide: (key: string, value: { isFeatureEnabled: () => boolean }) => { provided[key] = value; } } as never);
    expect(provided.posthog.isFeatureEnabled()).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('initializes flags immediately and captures only after consent on a production host', async () => {
    globalThis.__NUXT_CLIENT__ = true;
    globalThis.__NUXT_DEV__ = false;
    (process as NodeJS.Process & { client?: boolean }).client = true;
    vi.stubGlobal('window', { location: { hostname: 'app.mealdiary.co.uk' } });
    vi.stubGlobal('useRuntimeConfig', () => ({
      public: {
        posthogPublicKey: 'ph_key',
        posthogHost: 'https://eu.i.posthog.com',
        origin: 'https://app.mealdiary.co.uk',
        baseUrl: 'https://api.mealdiary.co.uk',
        gaMeasurementId: '',
      },
    }));
    const provided: Record<string, {
      capture: (event: string, properties?: Record<string, unknown>) => void;
      isFeatureEnabled: (key: string) => boolean;
      getFeatureFlag: (key: string) => unknown;
    }> = {};

    plugin({
      provide: (key: string, value: typeof provided[string]) => { provided[key] = value; },
    } as never);
    await Promise.resolve();

    expect(posthog.init).toHaveBeenCalled();
    expect(posthog.identify).toHaveBeenCalledWith('3', expect.objectContaining({ email: 'ada@example.com' }));
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();

    consent.current!.value = true;
    await nextTick();
    provided.posthog.capture('meal_saved', { id: 1 });

    expect(posthog.opt_in_capturing).toHaveBeenCalled();
    expect(posthog.capture).toHaveBeenCalledWith('meal_saved', { id: 1 });
    expect(provided.posthog.isFeatureEnabled('feature_flags_enabled')).toBe(true);
    expect(provided.posthog.getFeatureFlag('feature_flags_enabled')).toBe('variant');
  });
});
