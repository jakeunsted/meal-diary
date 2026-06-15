import type { EntitlementFeature, ResolvedEntitlements } from '~/types/Entitlements';

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
  });

  const prompts = computed(() => entitlements.value?.prompts ?? {
    trialExpired: false,
    paymentFailed: false,
    paymentFailedUntil: null,
  });

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

  return {
    entitlements,
    isPremium,
    currentPlan,
    hasFeature,
    billing,
    prompts,
    handleSyncEntitlements,
    refreshEntitlements,
  };
};
