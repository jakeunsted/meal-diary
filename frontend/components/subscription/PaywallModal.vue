<template>
  <dialog class="modal" :class="{ 'modal-open': isPaywallVisible }" data-testid="paywall-modal">
    <div class="modal-box">
      <button
        type="button"
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        data-testid="paywall-modal-close"
        @click="handleClose"
      >
        ✕
      </button>
      <template v-if="activePaywallCopy && isPaywallVisible">
        <h3 class="font-bold text-lg">{{ activePaywallCopy.title }}</h3>
        <p class="py-4">{{ activePaywallCopy.description }}</p>
        <div class="modal-action flex-col sm:flex-row gap-2">
          <button type="button" class="btn btn-ghost" @click="handleClose">
            {{ $t('paywall.close') }}
          </button>
          <NuxtLink
            v-if="activePaywallCopy.ctaHref"
            class="btn btn-primary"
            :to="activePaywallCopy.ctaHref"
            data-testid="paywall-modal-cta"
            @click="handleClose"
          >
            {{ activePaywallCopy.ctaLabel }}
          </NuxtLink>
          <button
            v-else
            type="button"
            class="btn btn-primary"
            disabled
            data-testid="paywall-modal-cta"
          >
            {{ activePaywallCopy.ctaLabel }}
          </button>
        </div>
      </template>
    </div>
    <form method="dialog" class="modal-backdrop" @submit.prevent="handleClose">
      <button type="submit">{{ $t('paywall.close') }}</button>
    </form>
  </dialog>
</template>

<script setup>
import { FEATURE_FLAGS } from '@meal-diary/shared';

const { isOpen, activeFeature, activePaywallCopy, closePaywall } = usePaywall();
const { enabled: alexaConnectionEnabled } = useFeatureFlag(FEATURE_FLAGS.alexaConnection);

const isPaywallVisible = computed(() => {
  if (!isOpen.value) {
    return false;
  }
  if (activeFeature.value === 'alexa' && !alexaConnectionEnabled.value) {
    return false;
  }
  return true;
});

const handleClose = () => {
  closePaywall();
};
</script>
