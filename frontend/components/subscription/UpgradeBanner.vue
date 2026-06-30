<template>
  <div
    v-if="isVisible"
    class="alert alert-warning mx-4 mt-4 shadow-sm"
    role="alert"
    data-testid="payment-failed-banner"
  >
    <div class="flex flex-col sm:flex-row sm:items-center gap-2 w-full">
      <div class="flex-1">
        <p class="font-medium">{{ $t('paywall.paymentFailed.title') }}</p>
        <p class="text-sm opacity-80">{{ $t('paywall.paymentFailed.description') }}</p>
      </div>
      <div class="flex gap-2 shrink-0">
        <button
          type="button"
          class="btn btn-warning btn-sm"
          data-testid="payment-failed-cta"
          :disabled="isOpeningPortal"
          @click="handleManageBilling"
        >
          <span v-if="isOpeningPortal" class="loading loading-spinner loading-xs"></span>
          <span v-else>{{ $t('paywall.paymentFailed.ownerCta') }}</span>
        </button>
        <button type="button" class="btn btn-ghost btn-sm" @click="handleDismiss">
          {{ $t('paywall.paymentFailed.dismiss') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
const { prompts, billing } = useEntitlements();
const userStore = useUserStore();

const dismissed = useState('payment-failed-banner-dismissed', () => false);
const isOpeningPortal = ref(false);

const isVisible = computed(() => {
  if (dismissed.value || !billing.value.isOwner) {
    return false;
  }

  return prompts.value.paymentFailed;
});

const handleDismiss = () => {
  dismissed.value = true;
};

const handleManageBilling = async () => {
  const familyGroupId = userStore.user?.family_group_id;
  if (!familyGroupId || isOpeningPortal.value) {
    return;
  }

  isOpeningPortal.value = true;

  try {
    const { api } = useApi();
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
    }
  } catch (error) {
    console.error('Failed to open billing portal:', error);
  } finally {
    isOpeningPortal.value = false;
  }
};
</script>
