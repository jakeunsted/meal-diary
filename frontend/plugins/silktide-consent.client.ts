import { useAnalyticsConsent } from '~/composables/useAnalyticsConsent';

/**
 * Loads the self-hosted Silktide Consent Manager and wires its "analytics"
 * consent type to our analytics consent state. Silktide owns the banner UI,
 * persistence of the banner's own choices, and the preferences modal; we only
 * react to its grant/revoke callbacks.
 *
 * Fail-closed: if the script can't load, analytics simply never gets consent.
 *
 * Self-hosted from /public/silktide so the Capacitor WebView loads it
 * same-origin with no extra third party.
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

  // Match the analytics plugin's environment gate — no banner where we never
  // track anyway (dev / staging hosts), to avoid noise during development.
  if (import.meta.dev) return;

  const { grantConsent, revokeConsent } = useAnalyticsConsent();

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
    // Re-show the banner until a choice is made
    autoShow: true,
    position: { banner: 'bottomLeft' },
    cookieIcon: { position: 'bottomLeft' },
    text: {
      banner: {
        description:
          '<p>We use essential cookies to run Meal Diary, and optional analytics to understand how the app is used and improve it. You can change your choice any time in your profile. See our <a href="/privacy" target="_blank">Privacy Policy</a>.</p>',
        acceptAllButtonText: 'Accept analytics',
        rejectNonEssentialButtonText: 'Essential only',
        preferencesButtonText: 'Manage preferences',
      },
      preferences: {
        title: 'Cookie preferences',
        description:
          '<p>Choose which optional cookies Meal Diary may use. Essential cookies are always on. See our <a href="/privacy" target="_blank">Privacy Policy</a>.</p>',
      },
    },
    consentTypes: [
      {
        id: 'necessary',
        name: 'Essential',
        description:
          'Required for Meal Diary to work — signing in, saving your meal plans, and keeping the app secure.',
        required: true,
        defaultValue: true,
      },
      {
        id: 'analytics',
        name: 'Analytics',
        description:
          'Helps us understand how the app is used so we can improve it. No analytics run until you allow them.',
        defaultValue: false,
        onAccept: () => { grantConsent(); },
        onReject: () => { revokeConsent(); },
      },
    ],
  });

  // Expose a reopen helper for the profile "Manage cookie preferences" button
  nuxtApp.provide('openCookiePreferences', () => {
    try {
      const instance = manager.getInstance?.();
      instance?.toggleModal?.(true);
    } catch (err) {
      console.warn('[silktide] could not open preferences modal', err);
    }
  });
});
