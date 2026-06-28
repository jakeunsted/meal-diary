<template>
  <dialog class="modal" :class="{ 'modal-open': isOpen }" data-testid="paywall-modal">
    <div class="modal-box">
      <button
        type="button"
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        data-testid="paywall-modal-close"
        @click="handleClose"
      >
        ✕
      </button>
      <template v-if="activePaywallCopy">
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
const { isOpen, activePaywallCopy, closePaywall } = usePaywall();

const handleClose = () => {
  closePaywall();
};
</script>
