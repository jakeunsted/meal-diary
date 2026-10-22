import posthog from 'posthog-js';
import type { FeatureFlagKey } from '@meal-diary/shared';
import { readFeatureFlagOverride } from '~/utils/featureFlagOverrides';

/**
 * Reactive PostHog feature flag for Nuxt.
 * Fail-closed: false while loading or if PostHog is unavailable.
 */
export const useFeatureFlag = (key: FeatureFlagKey) => {
  const enabled = ref(false);
  const value = ref<boolean | string | undefined>(undefined);
  const ready = ref(false);

  if (!import.meta.client) {
    return { enabled: readonly(enabled), value: readonly(value), ready: readonly(ready) };
  }

  const sync = () => {
    const override = readFeatureFlagOverride(key);
    if (override !== undefined) {
      value.value = override;
      enabled.value = override;
      ready.value = true;
      return;
    }

    try {
      const flagValue = posthog.getFeatureFlag(key) as boolean | string | undefined;
      value.value = flagValue;
      enabled.value = flagValue === true || flagValue === 'true';
      ready.value = true;
    } catch {
      enabled.value = false;
      value.value = undefined;
      ready.value = true;
    }
  };

  onMounted(() => {
    sync();

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = posthog.onFeatureFlags(() => {
        sync();
      });
    } catch { /* ignore */ }

    const timer = window.setTimeout(sync, 500);
    onUnmounted(() => {
      window.clearTimeout(timer);
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    });
  });

  return {
    enabled: readonly(enabled),
    value: readonly(value),
    ready: readonly(ready),
  };
};
