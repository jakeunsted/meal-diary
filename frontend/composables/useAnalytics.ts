/**
 * Custom analytics events. Routes through the consent-gated $posthog.track
 * wrapper (provided by plugins/analytics.client.ts), which fans each event out
 * to PostHog and GA4 (when configured). No-ops on the server, in dev, and
 * until the user has granted analytics consent — callers never need to guard.
 *
 * Event names follow GA4 conventions (snake_case; `login`/`sign_up` are GA4
 * recommended events) so they read natively in GA4 reporting.
 */
export const useAnalytics = () => {
  const track = (event: string, properties?: Record<string, any>) => {
    if (!import.meta.client) return;
    try {
      const { $posthog } = useNuxtApp();
      (($posthog as any)?.track)?.(event, properties);
    } catch {
      /* analytics must never break a user flow */
    }
  };

  return { track };
};
