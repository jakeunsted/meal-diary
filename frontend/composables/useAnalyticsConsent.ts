import { Preferences } from '@capacitor/preferences';

/**
 * Single source of truth for whether the user has consented to non-essential
 * analytics (PostHog, and GA4 when configured).
 *
 * The state is shared at module scope so every caller — the analytics plugin,
 * the Silktide consent banner, and the profile settings toggle — reads and
 * writes the same reactive value. Nothing analytics-related should run until
 * `analyticsConsent` is explicitly `true`; `null` means "undecided" and must
 * be treated as no-consent (fail closed).
 */

const PREF_KEY = 'analytics_consent';

type ConsentState = boolean | null;

// Module-scoped so it is a true singleton across the app
const analyticsConsent = ref<ConsentState>(null);
let loaded = false;

export const useAnalyticsConsent = () => {
  /**
   * Load the persisted decision once. Safe to call repeatedly.
   */
  const loadConsent = async (): Promise<ConsentState> => {
    if (loaded) return analyticsConsent.value;
    try {
      const { value } = await Preferences.get({ key: PREF_KEY });
      if (value === 'granted') analyticsConsent.value = true;
      else if (value === 'denied') analyticsConsent.value = false;
      else analyticsConsent.value = null;
    } catch {
      analyticsConsent.value = null;
    }
    loaded = true;
    return analyticsConsent.value;
  };

  const persist = async (state: Exclude<ConsentState, null>) => {
    try {
      await Preferences.set({ key: PREF_KEY, value: state ? 'granted' : 'denied' });
    } catch {
      /* persistence is best-effort; in-memory state still applies this session */
    }
  };

  const grantConsent = async () => {
    loaded = true;
    if (analyticsConsent.value !== true) {
      analyticsConsent.value = true;
    }
    await persist(true);
  };

  const revokeConsent = async () => {
    loaded = true;
    if (analyticsConsent.value !== false) {
      analyticsConsent.value = false;
    }
    await persist(false);
  };

  return {
    /** Reactive consent state: true = granted, false = denied, null = undecided */
    analyticsConsent,
    /** True only when analytics may run */
    hasAnalyticsConsent: computed(() => analyticsConsent.value === true),
    /** True when the user has not yet made a choice */
    isConsentUndecided: computed(() => analyticsConsent.value === null),
    loadConsent,
    grantConsent,
    revokeConsent,
  };
};
