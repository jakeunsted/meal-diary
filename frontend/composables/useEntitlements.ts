import type { EntitlementFeature, ResolvedEntitlements } from '~/types/Entitlements';
import {
  canEditMealWeek,
  isWeekAheadAllowed,
} from '~/utils/weekEntitlements';

export const useEntitlements = () => {
  const subscriptionStore = useSubscriptionStore();
  const userStore = useUserStore();

  const entitlements = computed(() => subscriptionStore.entitlements);
  const isPremium = computed(() => subscriptionStore.isPremium);
  const currentPlan = computed(() => subscriptionStore.currentPlan);

  const hasFeature = (feature: EntitlementFeature) =>
    computed(() => entitlements.value?.features[feature] ?? false);

  const billing = computed(() => entitlements.value?.billing ?? {
    isOwner: false,
    ownerDisplayName: null,
    trialAvailable: false,
    storePlatform: null,
  });

  const prompts = computed(() => entitlements.value?.prompts ?? {
    trialExpired: false,
    paymentFailed: false,
    paymentFailedUntil: null,
  });

  const limits = computed(() => entitlements.value?.limits);
  const usage = computed(() => entitlements.value?.usage);

  const recipesRemaining = computed(() => {
    const maxRecipes = limits.value?.maxRecipes;
    const recipeCount = usage.value?.recipeCount ?? 0;

    if (maxRecipes === undefined || !Number.isFinite(maxRecipes)) {
      return null;
    }

    return Math.max(0, maxRecipes - recipeCount);
  });

  const canNavigateToWeek = (weekStart: Date, referenceDate: Date = new Date()) => {
    const maxWeeksAhead = limits.value?.maxWeeksAhead ?? Number.POSITIVE_INFINITY;
    return isWeekAheadAllowed(weekStart, maxWeeksAhead, referenceDate);
  };

  const canEditWeek = (weekStart: Date, referenceDate: Date = new Date()) => {
    const maxWeeksAhead = limits.value?.maxWeeksAhead ?? Number.POSITIVE_INFINITY;
    const canEditPastWeeks = limits.value?.canEditPastWeeks ?? true;

    return canEditMealWeek(
      weekStart,
      maxWeeksAhead,
      canEditPastWeeks,
      referenceDate
    );
  };

  const isWeekReadOnly = (weekStart: Date, referenceDate: Date = new Date()) => {
    return canNavigateToWeek(weekStart, referenceDate) && !canEditWeek(weekStart, referenceDate);
  };

  const handleSyncEntitlements = (payload?: ResolvedEntitlements | null) => {
    if (payload) {
      subscriptionStore.setEntitlements(payload);
    }
  };

  const refreshEntitlements = async (force = false) => {
    const familyGroupId = userStore.user?.family_group_id;
    if (!familyGroupId) {
      subscriptionStore.clearCache();
      return null;
    }

    return subscriptionStore.fetchEntitlements(familyGroupId, force);
  };

  const refreshEntitlementsAfterUpgrade = async (sessionId?: string) => {
    const familyGroupId = userStore.user?.family_group_id;
    if (!familyGroupId) {
      return null;
    }

    if (sessionId) {
      try {
        const { api } = useApi();
        await api('/api/billing/confirm-checkout-session', {
          method: 'POST',
          silent: true,
          body: {
            session_id: sessionId,
            family_group_id: familyGroupId,
          },
        });
      } catch (error) {
        console.warn('[Entitlements] confirm-checkout-session failed', error);
      }
    }

    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const entitlements = await refreshEntitlements(true);
      if (entitlements?.plan === 'premium') {
        return entitlements;
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    return subscriptionStore.entitlements;
  };

  const dismissTrialExpiredPrompt = async () => {
    const familyGroupId = userStore.user?.family_group_id;
    if (!familyGroupId) {
      return null;
    }

    const { api } = useApi();
    const response = await api<ResolvedEntitlements>(
      `/api/family-groups/${familyGroupId}/entitlements/dismiss-prompt`,
      {
        method: 'POST',
        silent: true,
        body: { prompt: 'trial_expired' },
      }
    );

    subscriptionStore.setEntitlements(response);
    return response;
  };

  return {
    entitlements,
    isPremium,
    currentPlan,
    hasFeature,
    billing,
    prompts,
    limits,
    usage,
    recipesRemaining,
    canNavigateToWeek,
    canEditWeek,
    isWeekReadOnly,
    handleSyncEntitlements,
    refreshEntitlements,
    refreshEntitlementsAfterUpgrade,
    dismissTrialExpiredPrompt,
  };
};
