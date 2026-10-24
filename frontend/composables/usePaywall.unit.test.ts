import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePaywall } from './usePaywall';

describe('usePaywall', () => {
  beforeEach(() => {
    vi.stubGlobal('useSubscriptionStore', () => ({
      entitlements: {
        billing: { isOwner: false, ownerDisplayName: 'Ada' },
      },
    }));
  });

  it('opens owner and member copy for the active feature', () => {
    const paywall = usePaywall();
    expect(paywall.isOpen.value).toBe(false);

    paywall.openPaywall('recipes');
    expect(paywall.isOpen.value).toBe(true);
    expect(paywall.activePaywallCopy.value).toEqual({
      title: 'paywall.recipes.title',
      description: 'paywall.recipes.description',
      ctaLabel: 'paywall.recipes.nonOwnerCta:{"name":"Ada"}',
      ctaHref: null,
      isOwner: false,
    });

    vi.stubGlobal('useSubscriptionStore', () => ({
      entitlements: { billing: { isOwner: true, ownerDisplayName: null } },
    }));
    const owner = usePaywall();
    expect(owner.getPaywallCopy('recipes').ctaHref).toBe('/plans');
    expect(owner.getPaywallCopy('recipes').isOwner).toBe(true);

    paywall.closePaywall();
    expect(paywall.activePaywallCopy.value).toBeNull();
  });
});
