/**
 * Analytics consent for the marketing site.
 *
 * Same semantics as product web: true = granted, false = denied, null = undecided
 * (fail closed). Persistence uses localStorage — no Capacitor Preferences.
 */

const STORAGE_KEY = 'meal_diary_marketing_analytics_consent';

type ConsentState = boolean | null;

const analyticsConsent = ref<ConsentState>(null);
let loaded = false;

export const useAnalyticsConsent = () => {
  const loadConsent = async (): Promise<ConsentState> => {
    if (loaded) return analyticsConsent.value;
    if (!process.client) {
      loaded = true;
      return analyticsConsent.value;
    }
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
      if (value === 'granted') analyticsConsent.value = true;
      else if (value === 'denied') analyticsConsent.value = false;
      else analyticsConsent.value = null;
    } catch {
      analyticsConsent.value = null;
    }
    loaded = true;
    return analyticsConsent.value;
  };

  const persist = (state: Exclude<ConsentState, null>) => {
    if (!process.client) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, state ? 'granted' : 'denied');
    } catch {
      /* best-effort */
    }
  };

  const grantConsent = async () => {
    loaded = true;
    analyticsConsent.value = true;
    persist(true);
  };

  const revokeConsent = async () => {
    loaded = true;
    analyticsConsent.value = false;
    persist(false);
  };

  return {
    analyticsConsent,
    hasAnalyticsConsent: computed(() => analyticsConsent.value === true),
    isConsentUndecided: computed(() => analyticsConsent.value === null),
    loadConsent,
    grantConsent,
    revokeConsent,
  };
};
