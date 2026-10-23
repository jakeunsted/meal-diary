<template>
  <dialog
    class="modal"
    :class="{ 'modal-open': showModal }"
    data-testid="custom-meal-names-lapse-modal"
  >
    <div class="modal-box">
      <h3 class="font-bold text-lg" data-testid="custom-meal-names-lapse-title">
        {{ title }}
      </h3>
      <p class="py-2" data-testid="custom-meal-names-lapse-description">{{ description }}</p>
      <p
        v-if="hasResetError"
        class="text-error text-sm"
        data-testid="custom-meal-names-lapse-error"
      >
        {{ $t('paywall.customMealNamesLapse.error') }}
      </p>
      <div class="modal-action flex-col sm:flex-row gap-2">
        <button
          type="button"
          class="btn btn-ghost"
          data-testid="custom-meal-names-lapse-not-now"
          :disabled="isResetting"
          @click="handleNotNow"
        >
          {{ $t('paywall.customMealNamesLapse.notNow') }}
        </button>
        <button
          v-if="isOwner"
          type="button"
          class="btn btn-primary"
          data-testid="custom-meal-names-lapse-renew"
          :disabled="isResetting"
          @click="handleRenew"
        >
          {{ $t('paywall.customMealNamesLapse.renew') }}
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop" @submit.prevent="handleNotNow">
      <button type="submit">{{ $t('paywall.close') }}</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
const {
  prompts,
  billing,
  customMealNamesLapseHiddenForVisit,
  resetMealNamesToDefaults,
  hideCustomMealNamesLapseForVisit,
} = useEntitlements();
const { isOpen: isPaywallOpen } = usePaywall();
const { t } = useI18n();
const router = useRouter();

const isResetting = ref(false);
const hasResetError = ref(false);

const isOwner = computed(() => billing.value.isOwner);

const showModal = computed(() => {
  return prompts.value.customMealNamesLapse === true
    && !customMealNamesLapseHiddenForVisit.value
    && !isPaywallOpen.value;
});

const title = computed(() => {
  if (isOwner.value) {
    return t('paywall.customMealNamesLapse.ownerTitle');
  }

  return t('paywall.customMealNamesLapse.nonOwnerTitle');
});

const description = computed(() => {
  if (isOwner.value) {
    return t('paywall.customMealNamesLapse.ownerDescription');
  }

  const ownerName = billing.value.ownerDisplayName;
  if (ownerName) {
    return t('paywall.customMealNamesLapse.nonOwnerDescription', { name: ownerName });
  }

  return t('paywall.customMealNamesLapse.nonOwnerDescriptionGeneric');
});

const localToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const handleRenew = () => {
  if (isResetting.value) {
    return;
  }

  router.push('/plans');
};

const handleReset = async () => {
  if (isResetting.value) {
    return;
  }

  isResetting.value = true;
  hasResetError.value = false;

  try {
    await resetMealNamesToDefaults(localToday());
  } catch (error) {
    console.error('Failed to reset meal names:', error);
    hasResetError.value = true;
  } finally {
    isResetting.value = false;
  }
};

const handleNotNow = () => {
  if (isResetting.value) {
    return;
  }

  if (isOwner.value) {
    handleReset();
    return;
  }

  hideCustomMealNamesLapseForVisit();
};

const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !showModal.value) {
    return;
  }

  event.preventDefault();
  handleNotNow();
};

watch(showModal, (isShown) => {
  if (!import.meta.client) {
    return;
  }

  if (isShown) {
    window.addEventListener('keydown', handleKeyDown);
    return;
  }

  window.removeEventListener('keydown', handleKeyDown);
}, { immediate: true });

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener('keydown', handleKeyDown);
  }
});
</script>
