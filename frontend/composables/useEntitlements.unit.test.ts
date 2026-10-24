import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscriptionStore = {
  entitlements: null as {
    plan: string;
    features: { recipes: boolean };
    limits: { maxRecipes?: number; maxWeeksAhead?: number; canEditPastWeeks?: boolean };
    usage: { recipeCount: number };
    billing: { isOwner: boolean; ownerDisplayName: string | null; trialAvailable: boolean; storePlatform: null };
    prompts: { trialExpired: boolean; paymentFailed: boolean; paymentFailedUntil: null; customMealNamesLapse: boolean };
  } | null,
  isPremium: false,
  currentPlan: 'free',
  setEntitlements: vi.fn(),
  clearCache: vi.fn(),
  fetchEntitlements: vi.fn(),
};

const userStore = {
  user: { family_group_id: 9 } as { family_group_id?: number } | null,
};

const api = vi.fn();

import { useEntitlements } from './useEntitlements';

describe('useEntitlements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('useSubscriptionStore', () => subscriptionStore);
    vi.stubGlobal('useUserStore', () => userStore);
    vi.stubGlobal('useApi', () => ({ api }));
    userStore.user = { family_group_id: 9 };
    subscriptionStore.entitlements = {
      plan: 'free',
      features: { recipes: true },
      limits: { maxRecipes: 10, maxWeeksAhead: 0, canEditPastWeeks: false },
      usage: { recipeCount: 4 },
      billing: { isOwner: true, ownerDisplayName: null, trialAvailable: false, storePlatform: null },
      prompts: { trialExpired: false, paymentFailed: false, paymentFailedUntil: null, customMealNamesLapse: false },
    };
    subscriptionStore.setEntitlements.mockImplementation((value) => {
      subscriptionStore.entitlements = value;
    });
  });

  it('derives remaining recipes and week access from the cached plan', () => {
    const entitlements = useEntitlements();
    expect(entitlements.recipesRemaining.value).toBe(6);
    expect(entitlements.hasFeature('recipes').value).toBe(true);
    expect(entitlements.canNavigateToWeek(new Date(2026, 9, 19), new Date(2026, 9, 23))).toBe(true);
    expect(entitlements.canNavigateToWeek(new Date(2026, 10, 2), new Date(2026, 9, 23))).toBe(false);
    expect(entitlements.isWeekReadOnly(new Date(2026, 9, 12), new Date(2026, 9, 23))).toBe(true);

    subscriptionStore.entitlements = {
      ...subscriptionStore.entitlements!,
      limits: {},
      usage: { recipeCount: 4 },
    };
    expect(useEntitlements().recipesRemaining.value).toBeNull();
  });

  it('refreshes, dismisses a prompt, and resets meal names', async () => {
    subscriptionStore.fetchEntitlements.mockResolvedValue({ plan: 'premium' });
    const entitlements = useEntitlements();

    userStore.user = null;
    await expect(entitlements.refreshEntitlements()).resolves.toBeNull();
    expect(subscriptionStore.clearCache).toHaveBeenCalled();

    userStore.user = { family_group_id: 9 };
    await expect(entitlements.refreshEntitlements(true)).resolves.toEqual({ plan: 'premium' });
    expect(subscriptionStore.fetchEntitlements).toHaveBeenCalledWith(9, true);

    api.mockResolvedValue({ plan: 'free' });
    await entitlements.dismissTrialExpiredPrompt();
    expect(api).toHaveBeenCalledWith(
      '/api/family-groups/9/entitlements/dismiss-prompt',
      expect.objectContaining({ method: 'POST' })
    );

    await expect(entitlements.resetMealNamesToDefaults('2026-10-23')).resolves.toEqual({ plan: 'free' });
    entitlements.hideCustomMealNamesLapseForVisit();
    expect(entitlements.customMealNamesLapseHiddenForVisit.value).toBe(true);

    userStore.user = null;
    await expect(entitlements.resetMealNamesToDefaults('2026-10-23')).rejects.toThrow('Family group is required');
  });
});
