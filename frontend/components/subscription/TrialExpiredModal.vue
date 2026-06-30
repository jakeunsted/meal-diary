<template>
  <dialog class="modal" :class="{ 'modal-open': showModal }" data-testid="trial-expired-modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{{ $t('paywall.trialExpired.title') }}</h3>
      <p class="py-2">{{ $t('paywall.trialExpired.description') }}</p>
      <PlanComparisonTable class="my-4" />
      <div class="modal-action flex-col sm:flex-row gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          data-testid="trial-expired-dismiss"
          :disabled="isDismissing"
          @click="handleDismiss"
        >
          {{ $t('paywall.trialExpired.dismiss') }}
        </button>
        <NuxtLink
          class="btn btn-primary"
          to="/plans"
          data-testid="trial-expired-cta"
          @click="handleDismiss"
        >
          {{ $t('paywall.trialExpired.ownerCta') }}
        </NuxtLink>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @submit.prevent="handleDismiss">
      <button type="submit">{{ $t('paywall.close') }}</button>
    </form>
  </dialog>
</template>

<script setup>
import PlanComparisonTable from '~/components/subscription/PlanComparisonTable.vue';

const { prompts, dismissTrialExpiredPrompt } = useEntitlements();

const showModal = ref(false);
const isDismissing = ref(false);

watch(
  () => prompts.value.trialExpired,
  (shouldShow) => {
    showModal.value = shouldShow;
  },
  { immediate: true }
);

const handleDismiss = async () => {
  if (isDismissing.value) {
    return;
  }

  isDismissing.value = true;
  showModal.value = false;

  try {
    await dismissTrialExpiredPrompt();
  } catch (error) {
    console.error('Failed to dismiss trial expired prompt:', error);
  } finally {
    isDismissing.value = false;
  }
};
</script>
