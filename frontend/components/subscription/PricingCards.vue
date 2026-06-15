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
          :disabled="!canPurchase"
          @click="handleUpgrade('month')"
        >
          {{ ctaLabel }}
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
          :disabled="!canPurchase"
          @click="handleUpgrade('year')"
        >
          {{ ctaLabel }}
        </button>
        <p v-if="helperText" class="text-xs opacity-70 text-center">{{ helperText }}</p>
      </div>
    </div>
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

const canPurchase = computed(() => !props.isLoggedIn || props.isOwner);

const ctaLabel = computed(() => {
  if (!props.isLoggedIn) {
    return t('plansPage.getStarted');
  }
  if (props.isOwner) {
    return t('plansPage.comingSoon');
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
    return t('plansPage.billingComingSoon');
  }
  return '';
});

const handleUpgrade = (interval) => {
  if (!props.isLoggedIn) {
    navigateTo('/login');
    return;
  }
};
</script>
