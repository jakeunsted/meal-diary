import posthog from 'posthog-js';
import { useAuthStore } from '~/stores/auth';
import { useAnalyticsConsent } from '~/composables/useAnalyticsConsent';

/**
 * Consent-gated analytics.
 *
 * Nothing loads or tracks until the user grants analytics consent (handled by
 * the Silktide banner via useAnalyticsConsent). PostHog is the primary tool;
 * GA4 is scaffolded behind the same gate and stays dormant unless
 * GA_MEASUREMENT_ID (config.public.gaMeasurementId) is set.
 *
 * Every existing call site uses `$posthog.capture/identify/reset`, so we
 * provide a wrapper with that shape. The wrapper buffers nothing — it simply
 * no-ops until consent is granted, then drives the real SDKs. A `track` helper
 * is added for custom events that should also reach GA4.
 */

const POSTHOG_DISABLED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'dev.mealdiary.co.uk',
]);

function isAnalyticsDisabledHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (POSTHOG_DISABLED_HOSTS.has(host)) return true;
  return host.endsWith('.localhost');
}

function shouldDisableAnalytics(config: ReturnType<typeof useRuntimeConfig>): boolean {
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
  return hostnames.some(isAnalyticsDisabledHost);
}

interface AnalyticsApi {
  capture: (event: string, properties?: Record<string, any>) => void;
  identify: (distinctId: string, properties?: Record<string, any>) => void;
  reset: () => void;
  /** Custom event helper — fans out to PostHog and GA4 (when enabled) */
  track: (event: string, properties?: Record<string, any>) => void;
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();

  const noop: AnalyticsApi = {
    capture: () => {},
    identify: () => {},
    reset: () => {},
    track: () => {},
  };

  // Server side, or on disabled hosts (dev/staging), analytics never runs.
  if (!process.client || shouldDisableAnalytics(config)) {
    if (import.meta.dev) console.log('[analytics] disabled for this environment');
    nuxtApp.provide('posthog', noop);
    return;
  }

  const gaMeasurementId = (config.public.gaMeasurementId as string | undefined) || '';
  let posthogReady = false;
  let gaReady = false;

  // --- PostHog -------------------------------------------------------------
  const initPostHog = () => {
    if (posthogReady) return;
    const key = config.public.posthogPublicKey as string | undefined;
    if (!key) return;
    posthog.init(key, {
      api_host: (config.public.posthogHost as string) || 'https://eu.i.posthog.com',
      capture_pageview: false, // handled manually in middleware
      capture_pageleave: true,
      // Consent has been granted by the time we init, so opt-in by default
      opt_out_capturing_by_default: false,
    });
    posthogReady = true;

    // Replay identify for an already-logged-in user
    const authStore = useAuthStore();
    if (authStore.user) {
      posthog.identify(authStore.user.id.toString(), {
        email: authStore.user.email,
        name: `${authStore.user.first_name} ${authStore.user.last_name}`,
      });
    }
  };

  // --- GA4 (dormant unless a measurement id is configured) -----------------
  const initGa = () => {
    if (gaReady || !gaMeasurementId) return;
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.gtag = w.gtag || function gtag() { w.dataLayer.push(arguments); };
    w.gtag('js', new Date());
    // We gate consent ourselves, so disable GA's own ad/analytics storage prompts
    w.gtag('config', gaMeasurementId, { anonymize_ip: true, send_page_view: false });

    if (!document.getElementById('ga4-src')) {
      const s = document.createElement('script');
      s.id = 'ga4-src';
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}`;
      document.head.appendChild(s);
    }
    gaReady = true;
  };

  const enableAnalytics = () => {
    initPostHog();
    initGa();
  };

  const disableAnalytics = () => {
    if (posthogReady) {
      try { posthog.opt_out_capturing(); } catch { /* ignore */ }
      try { posthog.reset(); } catch { /* ignore */ }
    }
    // GA: flag consent off; no further events will be sent by our wrapper
    if (gaReady) {
      try { (window as any).gtag?.('consent', 'update', { analytics_storage: 'denied' }); } catch { /* ignore */ }
    }
  };

  const { analyticsConsent, hasAnalyticsConsent, loadConsent } = useAnalyticsConsent();

  // React to consent changes for the lifetime of the app
  watch(
    () => analyticsConsent.value,
    (granted) => {
      if (granted === true) enableAnalytics();
      else if (granted === false) disableAnalytics();
    },
    { immediate: false }
  );

  // Apply any previously-persisted decision on load
  loadConsent().then((state) => {
    if (state === true) enableAnalytics();
  });

  const gaEvent = (event: string, properties?: Record<string, any>) => {
    if (!gaReady) return;
    try { (window as any).gtag?.('event', event, properties || {}); } catch { /* ignore */ }
  };

  const api: AnalyticsApi = {
    capture: (event, properties) => {
      if (!hasAnalyticsConsent.value || !posthogReady) return;
      try { posthog.capture(event, properties); } catch { /* ignore */ }
    },
    identify: (distinctId, properties) => {
      if (!hasAnalyticsConsent.value || !posthogReady) return;
      try { posthog.identify(distinctId, properties); } catch { /* ignore */ }
    },
    reset: () => {
      if (!posthogReady) return;
      try { posthog.reset(); } catch { /* ignore */ }
    },
    track: (event, properties) => {
      if (!hasAnalyticsConsent.value) return;
      // PostHog capture + GA4 event for the same logical action
      if (posthogReady) {
        try { posthog.capture(event, properties); } catch { /* ignore */ }
      }
      gaEvent(event, properties);
    },
  };

  nuxtApp.provide('posthog', api);
});
