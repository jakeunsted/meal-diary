import posthog from 'posthog-js';
import type { FeatureFlagKey } from '@meal-diary/shared';
import { useAuthStore } from '~/stores/auth';
import { useAnalyticsConsent } from '~/composables/useAnalyticsConsent';

/**
 * PostHog always initializes for feature flags (including local/dev).
 * Analytics event capture is gated separately:
 * - Silktide / useAnalyticsConsent must grant consent
 * - Local/dev and known staging hosts never opt into capture
 *
 * Every existing call site uses `$posthog.capture/identify/reset/track`.
 * Flag helpers (`isFeatureEnabled` / `getFeatureFlag`) work regardless of consent.
 */

const POSTHOG_CAPTURE_DISABLED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'dev.mealdiary.co.uk',
]);

function isCaptureDisabledHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (POSTHOG_CAPTURE_DISABLED_HOSTS.has(host)) return true;
  return host.endsWith('.localhost');
}

function shouldDisableAnalyticsCapture(config: ReturnType<typeof useRuntimeConfig>): boolean {
  if (import.meta.dev) return true;

  const hostnames: string[] = [];
  if (process.client && typeof window !== 'undefined') {
    hostnames.push(window.location.hostname);
  }
  const origin = config.public.origin as string | undefined;
  if (origin) {
    try { hostnames.push(new URL(origin).hostname); } catch { /* ignore */ }
  }
  const baseUrl = config.public.baseUrl as string | undefined;
  if (baseUrl) {
    try { hostnames.push(new URL(baseUrl).hostname); } catch { /* ignore */ }
  }
  return hostnames.some(isCaptureDisabledHost);
}

interface AnalyticsApi {
  capture: (event: string, properties?: Record<string, any>) => void;
  identify: (distinctId: string, properties?: Record<string, any>) => void;
  reset: () => void;
  /** Custom event helper — fans out to PostHog and GA4 (when enabled) */
  track: (event: string, properties?: Record<string, any>) => void;
  isFeatureEnabled: (key: FeatureFlagKey | string) => boolean;
  getFeatureFlag: (key: FeatureFlagKey | string) => boolean | string | undefined;
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();

  const noop: AnalyticsApi = {
    capture: () => {},
    identify: () => {},
    reset: () => {},
    track: () => {},
    isFeatureEnabled: () => false,
    getFeatureFlag: () => undefined,
  };

  if (!process.client) {
    nuxtApp.provide('posthog', noop);
    return;
  }

  const gaMeasurementId = (config.public.gaMeasurementId as string | undefined) || '';
  const captureDisabledHost = shouldDisableAnalyticsCapture(config);
  let posthogReady = false;
  let gaReady = false;

  const initPostHog = () => {
    if (posthogReady) return;
    const key = config.public.posthogPublicKey as string | undefined;
    if (!key) return;

    posthog.init(key, {
      api_host: (config.public.posthogHost as string) || 'https://eu.i.posthog.com',
      capture_pageview: false, // handled manually in middleware
      capture_pageleave: true,
      // Flags load immediately; capture stays off until consent + non-dev host
      opt_out_capturing_by_default: true,
      defaults: (config.public.posthogDefaults as '2025-11-30' | undefined) || '2025-11-30',
    });
    posthogReady = true;

    // Always start opted out; enableAnalyticsCapture opts in when allowed
    try { posthog.opt_out_capturing(); } catch { /* ignore */ }

    // Associate the logged-in user for person-targeted flags (not gated on consent)
    const authStore = useAuthStore();
    if (authStore.user) {
      try {
        posthog.identify(authStore.user.id.toString(), {
          email: authStore.user.email,
          name: `${authStore.user.first_name} ${authStore.user.last_name}`,
        });
      } catch { /* ignore */ }
    }

    if (import.meta.dev) {
      console.log('[analytics] PostHog ready for feature flags; capture disabled in local/dev');
    }
  };

  const initGa = () => {
    if (gaReady || !gaMeasurementId || captureDisabledHost) return;
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.gtag = w.gtag || function gtag() { w.dataLayer.push(arguments); };
    w.gtag('js', new Date());
    w.gtag('config', gaMeasurementId, { anonymize_ip: true, send_page_view: false });

    if (!document.getElementById('ga4-src')) {
      const s = document.createElement('script');
      s.id = 'ga4-src';
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURICommand(gaMeasurementId)}`;
      document.head.appendChild(s);
    }
    gaReady = true;
  };

  const enableAnalyticsCapture = () => {
    initPostHog();
    if (captureDisabledHost) {
      // Flags stay available; never opt into capture on local/dev hosts
      return;
    }
    if (posthogReady) {
      try { posthog.opt_in_capturing(); } catch { /* ignore */ }
    }
    initGa();
  };

  const disableAnalyticsCapture = () => {
    if (posthogReady) {
      try { posthog.opt_out_capturing(); } catch { /* ignore */ }
    }
    if (gaReady) {
      try { (window as any).gtag?.('consent', 'update', { analytics_storage: 'denied' }); } catch { /* ignore */ }
    }
  };

  // Init immediately so flags evaluate before consent
  initPostHog();

  const { analyticsConsent, hasAnalyticsConsent, loadConsent } = useAnalyticsConsent();

  watch(
    () => analyticsConsent.value,
    (granted) => {
      if (granted === true) enableAnalyticsCapture();
      else if (granted === false) {
        disableAnalyticsCapture();
        // Privacy: clear person association when consent is explicitly denied,
        // then re-associate the session user so person-targeted flags still work.
        if (posthogReady) {
          try { posthog.reset(); } catch { /* ignore */ }
          const authStore = useAuthStore();
          if (authStore.user) {
            try {
              posthog.identify(authStore.user.id.toString(), {
                email: authStore.user.email,
                name: `${authStore.user.first_name} ${authStore.user.last_name}`,
              });
            } catch { /* ignore */ }
          }
        }
      }
    },
    { immediate: false }
  );

  loadConsent().then((state) => {
    if (state === true) enableAnalyticsCapture();
  });

  const gaEvent = (event: string, properties?: Record<string, any>) => {
    if (!gaReady || captureDisabledHost) return;
    try { (window as any).gtag?.('event', event, properties || {}); } catch { /* ignore */ }
  };

  const canCapture = () =>
    hasAnalyticsConsent.value && posthogReady && !captureDisabledHost;

  const api: AnalyticsApi = {
    capture: (event, properties) => {
      if (!canCapture()) return;
      try { posthog.capture(event, properties); } catch { /* ignore */ }
    },
    // Identify always runs when PostHog is ready so person-targeted flags work
    identify: (distinctId, properties) => {
      if (!posthogReady) return;
      try { posthog.identify(distinctId, properties); } catch { /* ignore */ }
    },
    reset: () => {
      if (!posthogReady) return;
      try { posthog.reset(); } catch { /* ignore */ }
    },
    track: (event, properties) => {
      if (!hasAnalyticsConsent.value || captureDisabledHost) return;
      if (posthogReady) {
        try { posthog.capture(event, properties); } catch { /* ignore */ }
      }
      gaEvent(event, properties);
    },
    isFeatureEnabled: (key) => {
      if (!posthogReady) return false;
      try {
        return Boolean(posthog.isFeatureEnabled(key));
      } catch {
        return false;
      }
    },
    getFeatureFlag: (key) => {
      if (!posthogReady) return undefined;
      try {
        return posthog.getFeatureFlag(key) as boolean | string | undefined;
      } catch {
        return undefined;
      }
    },
  };

  nuxtApp.provide('posthog', api);
});
