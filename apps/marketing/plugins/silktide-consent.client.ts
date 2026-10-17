import { useAnalyticsConsent } from '~/composables/useAnalyticsConsent';

/**
 * Loads the self-hosted Silktide Consent Manager and wires its "analytics"
 * consent type to marketing analytics consent state.
 *
 * Fail-closed: if the script can't load, analytics simply never gets consent.
 * Essential (necessary) remains required; PostHog error tracking is allowed
 * under Essential via the analytics plugin (not gated on Analytics accept).
 */

const CSS_HREF = '/silktide/silktide-consent-manager.css';
const JS_SRC = '/silktide/silktide-consent-manager.js';

function loadCss(href: string) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

export default defineNuxtPlugin(async (nuxtApp) => {
  if (!process.client) return;

  // Match product: skip banner where we never track (local/dev)
  if (import.meta.dev) return;

  const { grantConsent, revokeConsent } = useAnalyticsConsent();
  const config = useRuntimeConfig();
  const privacyUrl = (config.public.privacyUrl as string) || 'https://app.mealdiary.co.uk/privacy';

  try {
    loadCss(CSS_HREF);
    await loadScript(JS_SRC);
  } catch (err) {
    console.warn('[silktide] consent manager failed to load; analytics stay off', err);
    return;
  }

  const manager = (window as any).silktideConsentManager;
  if (!manager || typeof manager.init !== 'function') {
    console.warn('[silktide] consent manager global missing after load');
    return;
  }

  manager.init({
    autoShow: true,
    position: { banner: 'bottomLeft' },
    text: {
      banner: {
        description:
          `<p>We use essential cookies to run this website (including error reporting so we can fix problems), and optional analytics to understand how the site is used. You can change your choice any time via Cookie preferences in the footer. See our <a href="${privacyUrl}" target="_blank" rel="noopener">Privacy Policy</a>.</p>`,
        acceptAllButtonText: 'Accept analytics',
        rejectNonEssentialButtonText: 'Essential only',
        preferencesButtonText: 'Manage preferences',
      },
      preferences: {
        title: 'Cookie preferences',
        description:
          `<p>Choose which optional cookies this website may use. Essential cookies are always on. See our <a href="${privacyUrl}" target="_blank" rel="noopener">Privacy Policy</a>.</p>`,
      },
    },
    consentTypes: [
      {
        id: 'necessary',
        label: 'Essential',
        description:
          'Required for the website to work securely, and to report errors so we can keep Meal Diary reliable. Essential does not include marketing analytics or pageview tracking.',
        required: true,
        defaultValue: true,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        description:
          'Helps us understand how the marketing site is used (pageviews and marketing events via Google Analytics and PostHog). No analytics run until you allow them.',
        defaultValue: false,
        onAccept: () => { grantConsent(); },
        onReject: () => { revokeConsent(); },
      },
    ],
  });

  nuxtApp.provide('openCookiePreferences', () => {
    try {
      const instance = manager.getInstance?.();
      instance?.toggleModal?.(true);
    } catch (err) {
      console.warn('[silktide] could not open preferences modal', err);
    }
  });
});
