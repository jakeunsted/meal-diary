import { describe, expect, it, vi } from 'vitest';

const authStore = { isAuthenticated: true, user: { family_group_id: 4 } as { family_group_id?: number } | null };
const subscriptionStore = { hydrateFromStorage: vi.fn() };
const refreshEntitlements = vi.fn();

import plugin from './entitlements.client';

describe('entitlements plugin', () => {
  it('does nothing away from the client', async () => {
    vi.stubGlobal('useAuthStore', () => authStore);
    vi.stubGlobal('useSubscriptionStore', () => subscriptionStore);
    vi.stubGlobal('useEntitlements', () => ({ refreshEntitlements }));

    await plugin();
    expect(subscriptionStore.hydrateFromStorage).not.toHaveBeenCalled();
  });

  it('hydrates and refreshes when the signed-in user has a family', async () => {
    globalThis.__NUXT_CLIENT__ = true;
    vi.stubGlobal('useAuthStore', () => authStore);
    vi.stubGlobal('useSubscriptionStore', () => subscriptionStore);
    vi.stubGlobal('useEntitlements', () => ({ refreshEntitlements }));
    refreshEntitlements.mockRejectedValueOnce(new Error('offline'));

    await plugin();

    expect(subscriptionStore.hydrateFromStorage).toHaveBeenCalled();
    expect(refreshEntitlements).toHaveBeenCalled();
  });
});
