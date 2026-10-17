import posthog from 'posthog-js';
import { useAnalyticsConsent } from '~/composables/useAnalyticsConsent';

/**
 * Marketing analytics (fail-closed):
 * - PostHog and GA4 only initialize after Analytics consent is granted.
 * - No PostHog cookies, config, or network calls before that choice.
 * - On revoke: opt out and reset PostHog; deny GA storage.
 *
 * Capture stays disabled on local/dev hosts even after consent.
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
  const siteUrl = config.public.siteUrl as string | undefined;
  if (siteUrl) {
    try { hostnames.push(new URL(siteUrl).hostname); } catch { /* ignore */ }
  }
  return hostnames.some(isCaptureDisabledHost);
}

interface PostHogLogger {
  info: (body: string, attributes?: Record<string, any>) => void;
  warn: (body: string, attributes?: Record<string, any>) => void;
  error: (body: string, attributes?: Record<string, any>) => void;
}

interface AnalyticsApi {
  capture: (event: string, properties?: Record<string, any>) => void;
  track: (event: string, properties?: Record<string, any>) => void;
  logger: PostHogLogger;
}

const noopLogger: PostHogLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();

  const noop: AnalyticsApi = {
    capture: () => {},
    track: () => {},
    logger: noopLogger,
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
      capture_pageview: false,
      capture_pageleave: true,
      opt_out_capturing_by_default: true,
      defaults: (config.public.posthogDefaults as '2025-11-30' | undefined) || '2025-11-30',
      logs: {
        serviceName: 'meal-diary-marketing',
        environment: import.meta.dev ? 'development' : 'production',
      },
    });
    posthogReady = true;

    if (import.meta.dev) {
      console.log('[analytics] PostHog initialized after Analytics consent');
    }
  };

  const initGa = () => {
    if (gaReady || !gaMeasurementId || captureDisabledHost) return;
    const w = window as any;
    w.dataLayer = w.dataLayer || [];
    w.gtag = w.gtag || function gtag() { w.dataLayer.push(arguments); };
    w.gtag('js', new Date());
    w.gtag('consent', 'default', { analytics_storage: 'denied' });
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

  const enableAnalyticsCapture = () => {
    if (captureDisabledHost) return;
    initPostHog();
    if (posthogReady) {
      try { posthog.opt_in_capturing(); } catch { /* ignore */ }
    }
    initGa();
    if (gaReady) {
      try {
        (window as any).gtag?.('consent', 'update', { analytics_storage: 'granted' });
      } catch { /* ignore */ }
    }
  };

  const disableAnalyticsCapture = () => {
    if (posthogReady) {
      try { posthog.opt_out_capturing(); } catch { /* ignore */ }
      try { posthog.reset(); } catch { /* ignore */ }
    }
    if (gaReady) {
      try {
        (window as any).gtag?.('consent', 'update', { analytics_storage: 'denied' });
      } catch { /* ignore */ }
    }
  };

  const { analyticsConsent, hasAnalyticsConsent, loadConsent } = useAnalyticsConsent();

  watch(
    () => analyticsConsent.value,
    (granted) => {
      if (granted === true) enableAnalyticsCapture();
      else if (granted === false) disableAnalyticsCapture();
    },
    { immediate: false },
  );

  loadConsent().then((state) => {
    if (state === true) enableAnalyticsCapture();
  });

  const gaEvent = (event: string, properties?: Record<string, any>) => {
    if (!gaReady || captureDisabledHost || !hasAnalyticsConsent.value) return;
    try { (window as any).gtag?.('event', event, properties || {}); } catch { /* ignore */ }
  };

  const canCapture = () =>
    hasAnalyticsConsent.value && posthogReady && !captureDisabledHost;

  const api: AnalyticsApi = {
    capture: (event, properties) => {
      if (!canCapture()) return;
      try { posthog.capture(event, properties); } catch { /* ignore */ }
    },
    track: (event, properties) => {
      if (!hasAnalyticsConsent.value || captureDisabledHost) return;
      if (posthogReady) {
        try { posthog.capture(event, properties); } catch { /* ignore */ }
      }
      gaEvent(event, properties);
    },
    logger: {
      info: (body, attributes) => {
        if (!canCapture()) return;
        try { posthog.logger.info(body, attributes); } catch { /* ignore */ }
      },
      warn: (body, attributes) => {
        if (!canCapture()) return;
        try { posthog.logger.warn(body, attributes); } catch { /* ignore */ }
      },
      error: (body, attributes) => {
        if (!canCapture()) return;
        try { posthog.logger.error(body, attributes); } catch { /* ignore */ }
      },
    },
  };

  nuxtApp.provide('posthog', api);
});
