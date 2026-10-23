import { describe, expect, it, vi } from 'vitest';

const grantConsent = vi.hoisted(() => vi.fn());
const revokeConsent = vi.hoisted(() => vi.fn());

vi.mock('~/composables/useAnalyticsConsent', () => ({
  useAnalyticsConsent: () => ({ grantConsent, revokeConsent }),
}));

import plugin from './silktide-consent.client';

describe('silktide consent plugin', () => {
  it('skips the banner in development', async () => {
    (process as NodeJS.Process & { client?: boolean }).client = true;
    globalThis.__NUXT_DEV__ = true;
    const init = vi.fn();
    vi.stubGlobal('window', { silktideConsentManager: { init } });

    await plugin({ provide: vi.fn() } as never);
    expect(init).not.toHaveBeenCalled();
  });

  it('wires analytics consent to the manager callbacks', async () => {
    (process as NodeJS.Process & { client?: boolean }).client = true;
    globalThis.__NUXT_DEV__ = false;

    const init = vi.fn();
    const toggleModal = vi.fn();
    const created: Array<{ onload?: () => void; onerror?: () => void; src?: string }> = [];
    vi.stubGlobal('document', {
      querySelector: () => null,
      createElement: () => {
        const element: { onload?: () => void; onerror?: () => void; src?: string } = {};
        created.push(element);
        return element;
      },
      head: {
        appendChild: (element: { onload?: () => void }) => {
          element.onload?.();
        },
      },
    });
    vi.stubGlobal('window', {
      silktideConsentManager: {
        init,
        getInstance: () => ({ toggleModal }),
      },
    });
    const provide = vi.fn();

    await plugin({ provide } as never);

    expect(init).toHaveBeenCalled();
    const config = init.mock.calls[0][0];
    const analytics = config.consentTypes.find((type: { id: string }) => type.id === 'analytics');
    analytics.onAccept();
    analytics.onReject();
    expect(grantConsent).toHaveBeenCalled();
    expect(revokeConsent).toHaveBeenCalled();

    provide.mock.calls[0][1]();
    expect(toggleModal).toHaveBeenCalledWith(true);
  });
});
