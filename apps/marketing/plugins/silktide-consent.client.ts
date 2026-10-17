import { useAnalyticsConsent } from '~/composables/useAnalyticsConsent';

/**
 * Loads the self-hosted Silktide Consent Manager and wires its "analytics"
 * consent type to marketing analytics consent state.
 *
 * Fail-closed: if the script can't load, analytics simply never gets consent.
 * Essential (necessary) is required for the site to work. PostHog and GA4
 * only initialize after Analytics consent (see analytics.client.ts).
 */

const CSS_HREF = '/silktide/silktide-consent-manager.css';
const JS_SRC = '/silktide/silktide-consent-manager.js';
const CLOSE_BUTTON_LABEL = 'Close cookie preferences';

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

/** Silktide reuses preferencesAccessibleLabel for the modal close control; set a clear name. */
function patchSilktideCloseLabels() {
  document.querySelectorAll<HTMLButtonElement>('.stcm-modal-close').forEach((btn) => {
    if (btn.getAttribute('aria-label') !== CLOSE_BUTTON_LABEL) {
      btn.setAttribute('aria-label', CLOSE_BUTTON_LABEL);
    }
  });
}

function watchSilktideCloseLabels() {
  patchSilktideCloseLabels();
  const observer = new MutationObserver(() => patchSilktideCloseLabels());
  observer.observe(document.body, { childList: true, subtree: true });
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
    // Silktide v2 reads prompt.position / text.prompt (not position.banner / text.banner)
    prompt: { position: 'bottomLeft' },
    text: {
      prompt: {
        description:
          `<p>We use essential cookies to run this website, and optional analytics (Google Analytics and PostHog) to understand how the site is used. Analytics cookies are off until you choose Accept analytics. You can change your choice any time via Cookie preferences in the footer. See our <a href="${privacyUrl}" target="_blank" rel="noopener">Privacy Policy</a>.</p>`,
        acceptAllButtonText: 'Accept analytics',
        rejectNonEssentialButtonText: 'Essential only',
        preferencesButtonText: 'Manage preferences',
      },
      preferences: {
        title: 'Cookie preferences',
        description:
          `<p>Choose which optional cookies this website may use. Essential cookies are always on. Analytics (including error and usage reporting) stay off until you allow them. See our <a href="${privacyUrl}" target="_blank" rel="noopener">Privacy Policy</a>.</p>`,
      },
    },
    consentTypes: [
      {
        id: 'necessary',
        label: 'Essential',
        description:
          'Required for the website to work securely (for example remembering your cookie choice). Essential does not include Google Analytics, PostHog, or pageview tracking.',
        required: true,
        defaultValue: true,
      },
      {
        id: 'analytics',
        label: 'Analytics',
        description:
          'Helps us understand how the marketing site is used and report errors (pageviews and marketing events via Google Analytics and PostHog). Nothing in this category runs until you allow it.',
        defaultValue: false,
        onAccept: () => { grantConsent(); },
        onReject: () => { revokeConsent(); },
      },
    ],
  });

  watchSilktideCloseLabels();

  nuxtApp.provide('openCookiePreferences', () => {
    try {
      const instance = manager.getInstance?.();
      instance?.toggleModal?.(true);
      patchSilktideCloseLabels();
    } catch (err) {
      console.warn('[silktide] could not open preferences modal', err);
    }
  });
});
