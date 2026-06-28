<template>
  <div class="card bg-base-200 h-full">
    <div class="card-body">
      <h2 class="card-title">{{ $t('plansPage.subscription') }}</h2>
      <p v-if="subscriptionStore.loading" class="text-sm opacity-70">
        <span class="loading loading-spinner loading-sm"></span>
      </p>
      <template v-else>
        <p class="text-sm opacity-70">
          {{ $t('plansPage.currentPlanLabel', { plan: planLabel }) }}
        </p>
        <p
          v-if="entitlements?.trial"
          class="text-sm text-primary"
        >
          {{ $t('plansPage.trialDaysRemaining', { days: entitlements.trial.daysRemaining }) }}
        </p>
      </template>
      <div class="card-actions mt-auto flex-wrap">
        <NuxtLink class="btn btn-primary btn-sm" to="/plans">
          {{ $t('plansPage.viewPlans') }}
        </NuxtLink>
        <button
          v-if="canManageBilling"
          type="button"
          class="btn btn-outline btn-sm"
          :disabled="isOpeningPortal"
          @click="handleManageBilling"
        >
          <span v-if="isOpeningPortal" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ manageBillingLabel }}</span>
        </button>
        <button
          v-if="canRestorePurchases"
          type="button"
          class="btn btn-ghost btn-sm"
          :disabled="isRestoringPurchases"
          @click="handleRestorePurchases"
        >
          <span v-if="isRestoringPurchases" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ $t('plansPage.restorePurchases') }}</span>
        </button>
      </div>
      <p v-if="billingError" class="text-sm text-error mt-2">{{ billingError }}</p>
    </div>
  </div>
</template>

<script setup>
const subscriptionStore = useSubscriptionStore();
const userStore = useUserStore();
const { entitlements, currentPlan, billing, refreshEntitlements } = useEntitlements();
const { restorePurchases, isNativePlatform } = useRevenueCat();
const { t } = useI18n();
const { api } = useApi();

const isOpeningPortal = ref(false);
const isRestoringPurchases = ref(false);
const billingError = ref('');

const planLabel = computed(() => {
  if (currentPlan.value === 'premium') {
    return t('plansPage.familyPlus');
  }
  return t('plansPage.free');
});

const isStoreManaged = computed(() =>
  billing.value.storePlatform === 'ios' || billing.value.storePlatform === 'android'
);

const canManageBilling = computed(() =>
  billing.value.isOwner &&
  currentPlan.value === 'premium' &&
  !entitlements.value?.isComplimentary
);

const canRestorePurchases = computed(() =>
  isNativePlatform.value && billing.value.isOwner && isStoreManaged.value
);

const manageBillingLabel = computed(() => {
  if (billing.value.storePlatform === 'ios') {
    return t('plansPage.manageInAppStore');
  }
  if (billing.value.storePlatform === 'android') {
    return t('plansPage.manageInPlayStore');
  }
  return t('plansPage.manageBilling');
});

const handleManageBilling = async () => {
  const familyGroupId = userStore.user?.family_group_id;
  if (!familyGroupId || isOpeningPortal.value) {
    return;
  }

  isOpeningPortal.value = true;
  billingError.value = '';

  try {
    if (isStoreManaged.value) {
      const storeUrl = billing.value.storePlatform === 'ios'
        ? 'https://apps.apple.com/account/subscriptions'
        : 'https://play.google.com/store/account/subscriptions';
      window.open(storeUrl, '_blank');
      return;
    }

    const session = await api('/api/billing/create-portal-session', {
      method: 'POST',
      silent: true,
      body: {
        family_group_id: familyGroupId,
        return_url: `${window.location.origin}/profile?upgraded=1`,
      },
    });

    if (session?.url) {
      window.location.href = session.url;
      return;
    }

    billingError.value = t('plansPage.portalFailed');
  } catch (error) {
    billingError.value = t('plansPage.portalFailed');
  } finally {
    isOpeningPortal.value = false;
  }
};

const handleRestorePurchases = async () => {
  if (isRestoringPurchases.value) {
    return;
  }

  isRestoringPurchases.value = true;
  billingError.value = '';

  try {
    await restorePurchases();
    await refreshEntitlements(true);
  } catch (error) {
    billingError.value = t('plansPage.nativeCheckoutFailed');
  } finally {
    isRestoringPurchases.value = false;
  }
};
</script>
