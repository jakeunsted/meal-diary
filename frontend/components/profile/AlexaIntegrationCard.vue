<template>
  <article class="card bg-base-200" data-testid="alexa-settings">
    <div class="card-body gap-4">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="card-title">{{ $t('alexa.settingsTitle') }}</h2>
          <p class="mt-1 text-sm opacity-70">{{ $t('alexa.settingsDescription') }}</p>
        </div>
        <span
          v-if="!alexaSectionLoading && !alexaStatusError"
          class="badge badge-outline shrink-0"
          data-testid="alexa-status-badge"
        >
          {{ statusLabel }}
        </span>
      </div>

      <div v-if="alexaSectionLoading" data-testid="alexa-status-loading">
        <span class="loading loading-spinner loading-sm"></span>
      </div>
      <div v-else-if="alexaStatusError" class="alert alert-error" data-testid="alexa-status-error">
        <span>{{ $t('alexa.statusError') }}</span>
      </div>
      <template v-else>
        <p v-if="!alexaConnected && hasAlexa" class="text-sm opacity-70">
          {{ $t('alexa.notConnectedHint') }}
        </p>
        <template v-if="!hasAlexa">
          <p>{{ $t('alexa.premiumDescription') }}</p>
          <p v-if="!billing.isOwner" class="text-sm" data-testid="alexa-non-owner">
            {{ alexaNonOwnerMessage }}
          </p>
        </template>

        <div
          v-if="(!hasAlexa && billing.isOwner) || alexaConnected"
          class="card-actions justify-end"
        >
          <button
            v-if="!hasAlexa && billing.isOwner"
            type="button"
            class="btn btn-primary btn-sm"
            data-testid="alexa-upgrade-button"
            @click="handleUpgrade"
          >
            {{ $t('paywall.alexa.ownerCta') }}
          </button>
          <button
            v-if="alexaConnected"
            type="button"
            class="btn btn-outline btn-sm"
            data-testid="alexa-disconnect-button"
            @click="handleDisconnect"
          >
            {{ $t('alexa.disconnect') }}
          </button>
        </div>
      </template>
    </div>
  </article>

  <dialog ref="alexaDisconnectModal" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg">{{ $t('alexa.disconnect') }}</h3>
      <p class="py-3">{{ $t('alexa.disconnectConfirm') }}</p>
      <div v-if="alexaDisconnectError" class="alert alert-error">
        <span>{{ $t('alexa.disconnectFailed') }}</span>
      </div>
      <div class="modal-action">
        <button class="btn" type="button" :disabled="alexaDisconnecting" @click="handleCancelDisconnect">
          {{ $t('Cancel') }}
        </button>
        <button
          class="btn btn-error"
          type="button"
          data-testid="alexa-disconnect-confirm"
          :disabled="alexaDisconnecting"
          @click="handleConfirmDisconnect"
        >
          <span v-if="alexaDisconnecting" class="loading loading-spinner loading-sm"></span>
          <span v-else>{{ $t('alexa.disconnect') }}</span>
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button :disabled="alexaDisconnecting">{{ $t('close') }}</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia';
import type { AlexaLinkStatus } from '@meal-diary/shared';
import { useFamilyStore } from '~/stores/family';

const { t } = useI18n();
const familyStore = useFamilyStore();
const { familyGroup } = storeToRefs(familyStore);
const { api } = useApi();
const { entitlements, billing } = useEntitlements();
const { openPaywall } = usePaywall();

const alexaStatus = ref<AlexaLinkStatus | null>(null);
const alexaStatusLoading = ref(false);
const alexaStatusError = ref(false);
const alexaDisconnectModal = ref<HTMLDialogElement | null>(null);
const alexaDisconnecting = ref(false);
const alexaDisconnectError = ref(false);

const hasAlexa = computed(() => entitlements.value?.features.alexa === true);
const alexaConnected = computed(() => alexaStatus.value?.connected === true);
const alexaSectionLoading = computed(() =>
  alexaStatusLoading.value || !entitlements.value
);
const statusLabel = computed(() => {
  if (!hasAlexa.value) {
    return t('integrations.familyPlus');
  }
  return alexaConnected.value ? t('alexa.connected') : t('alexa.notConnected');
});
const alexaNonOwnerMessage = computed(() => {
  const name = billing.value.ownerDisplayName;
  if (name) {
    return t('paywall.alexa.nonOwnerCta', { name });
  }
  return t('paywall.alexa.nonOwnerCtaGeneric');
});

const loadAlexaStatus = async () => {
  alexaStatusLoading.value = true;
  alexaStatusError.value = false;
  try {
    alexaStatus.value = await api<AlexaLinkStatus>('/api/alexa/link', { silent: true });
  } catch {
    alexaStatus.value = null;
    alexaStatusError.value = true;
  } finally {
    alexaStatusLoading.value = false;
  }
};

const handleUpgrade = () => {
  openPaywall('alexa');
};

const handleDisconnect = () => {
  alexaDisconnectError.value = false;
  alexaDisconnectModal.value?.showModal();
};

const handleCancelDisconnect = () => {
  alexaDisconnectModal.value?.close();
};

const handleConfirmDisconnect = async () => {
  alexaDisconnectError.value = false;
  alexaDisconnecting.value = true;
  try {
    await api('/api/alexa/link', { method: 'DELETE', silent: true });
    alexaDisconnectModal.value?.close();
    await loadAlexaStatus();
  } catch {
    alexaDisconnectError.value = true;
  } finally {
    alexaDisconnecting.value = false;
  }
};

watch(
  () => familyGroup.value?.id,
  (familyId) => {
    if (familyId) {
      loadAlexaStatus();
    }
  },
  { immediate: true },
);
</script>
