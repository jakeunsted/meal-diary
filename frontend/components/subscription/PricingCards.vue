<template>
  <div class="grid gap-4 md:grid-cols-3">
    <div class="card bg-base-200">
      <div class="card-body">
        <h3 class="card-title">{{ $t('plansPage.free') }}</h3>
        <p class="text-3xl font-bold">£0</p>
        <p class="text-sm opacity-70">{{ $t('plansPage.freeDescription') }}</p>
        <div class="card-actions justify-end mt-4">
          <span class="badge badge-ghost">{{ $t('plansPage.currentPlanBadge') }}</span>
        </div>
      </div>
    </div>

    <div class="card bg-base-200 border border-primary">
      <div class="card-body">
        <div class="flex items-center gap-2">
          <h3 class="card-title">{{ $t('plansPage.monthly') }}</h3>
          <span class="badge badge-primary badge-sm">{{ $t('plansPage.trialBadge') }}</span>
        </div>
        <p class="text-3xl font-bold">£2.99<span class="text-base font-normal opacity-70">/mo</span></p>
        <button
          type="button"
          class="btn btn-primary w-full"
          :disabled="!canPurchase || loadingInterval === 'month'"
          @click="handleUpgrade('month')"
        >
          <span v-if="loadingInterval === 'month'" class="loading loading-spinner loading-sm"></span>
          <span v-else>{{ ctaLabel }}</span>
        </button>
        <p v-if="helperText" class="text-xs opacity-70 text-center">{{ helperText }}</p>
      </div>
    </div>

    <div class="card bg-base-200 border border-primary">
      <div class="card-body">
        <div class="flex items-center gap-2">
          <h3 class="card-title">{{ $t('plansPage.yearly') }}</h3>
          <span class="badge badge-primary badge-sm">{{ $t('plansPage.trialBadge') }}</span>
        </div>
        <p class="text-3xl font-bold">£24.99<span class="text-base font-normal opacity-70">/yr</span></p>
        <button
          type="button"
          class="btn btn-primary w-full"
          :disabled="!canPurchase || loadingInterval === 'year'"
          @click="handleUpgrade('year')"
        >
          <span v-if="loadingInterval === 'year'" class="loading loading-spinner loading-sm"></span>
          <span v-else>{{ ctaLabel }}</span>
        </button>
        <p v-if="helperText" class="text-xs opacity-70 text-center">{{ helperText }}</p>
      </div>
    </div>
    <p v-if="checkoutError" class="md:col-span-3 text-sm text-error text-center">
      {{ checkoutError }}
    </p>
  </div>
</template>

<script setup>
const props = defineProps({
  isOwner: {
    type: Boolean,
    default: false,
  },
  ownerDisplayName: {
    type: String,
    default: null,
  },
  isLoggedIn: {
    type: Boolean,
    default: false,
  },
});

const { t } = useI18n();
const userStore = useUserStore();
const { api } = useApi();
const { track } = useAnalytics();
const loadingInterval = ref(null);
const checkoutError = ref('');

const canPurchase = computed(() => !props.isLoggedIn || props.isOwner);

const ctaLabel = computed(() => {
  if (!props.isLoggedIn) {
    return t('plansPage.getStarted');
  }
  if (props.isOwner) {
    return t('plansPage.startFreeTrial');
  }
  if (props.ownerDisplayName) {
    return t('plansPage.askOwnerToUpgrade', { name: props.ownerDisplayName });
  }
  return t('plansPage.askOwnerToUpgradeGeneric');
});

const helperText = computed(() => {
  if (!props.isLoggedIn) {
    return t('plansPage.loginToUpgrade');
  }
  if (!props.isOwner && props.ownerDisplayName) {
    return t('plansPage.ownerManagesBilling', { name: props.ownerDisplayName });
  }
  if (props.isOwner) {
    return t('plansPage.billingRedirectHint');
  }
  return '';
});

const handleUpgrade = async (interval) => {
  if (!props.isLoggedIn) {
    navigateTo('/login');
    return;
  }

  if (!props.isOwner || loadingInterval.value) {
    return;
  }

  const familyGroupId = userStore.user?.family_group_id;
  if (!familyGroupId) {
    checkoutError.value = t('plansPage.missingFamilyGroup');
    return;
  }

  loadingInterval.value = interval;
  checkoutError.value = '';

  try {
    track('begin_checkout', {
      currency: 'GBP',
      value: interval === 'year' ? 24.99 : 2.99,
      interval,
    });

    const session = await api('/api/billing/create-checkout-session', {
      method: 'POST',
      silent: true,
      body: {
        family_group_id: familyGroupId,
        interval,
        success_url: `${window.location.origin}/profile?upgraded=1`,
        cancel_url: `${window.location.origin}/plans`,
      },
    });

    if (session?.url) {
      window.location.href = session.url;
      return;
    }

    checkoutError.value = t('plansPage.checkoutFailed');
  } catch (error) {
    const errorData = error?.data?.data ?? error?.data;
    checkoutError.value =
      errorData?.code === 'TRIAL_ALREADY_USED'
        ? t('plansPage.trialAlreadyUsed')
        : t('plansPage.checkoutFailed');
  } finally {
    loadingInterval.value = null;
  }
};
</script>
