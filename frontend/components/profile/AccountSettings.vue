<template>
  <div class="card bg-base-200 h-full">
    <div class="card-body">
      <h2 class="card-title">{{ $t('Account') }}</h2>
      <p class="text-sm opacity-70">
        {{ $t('Deleting your account is permanent and cannot be undone.') }}
      </p>
      <div class="card-actions mt-auto">
        <LogoutButton />
        <button
          class="btn btn-error btn-outline"
          data-testid="delete-account-button"
          @click="openModal"
        >
          {{ $t('Delete account') }}
        </button>
      </div>
    </div>
  </div>

  <dialog ref="modal" class="modal">
    <div class="modal-box">
      <h3 class="font-bold text-lg text-error">{{ $t('Delete account') }}</h3>

      <p class="py-2">{{ $t('This will permanently delete:') }}</p>
      <ul class="list-disc list-inside text-sm opacity-80 space-y-1 mb-4">
        <li>{{ $t('Your account and login details') }}</li>
        <li>{{ $t('Your name on recipes you created (the recipes stay with your family group)') }}</li>
        <li>{{ $t('If you are the only member of your family group, all of its meal diaries, recipes, and shopping lists') }}</li>
      </ul>

      <div class="form-control">
        <label class="label">
          <span class="label-text">
            {{ hasPassword ? $t('Enter your password to confirm') : $t('Type DELETE to confirm') }}
          </span>
        </label>
        <input
          v-if="hasPassword"
          type="password"
          v-model="confirmInput"
          class="input input-bordered w-full"
          data-testid="delete-confirm-input"
          :disabled="isDeleting"
        />
        <input
          v-else
          type="text"
          v-model="confirmInput"
          placeholder="DELETE"
          class="input input-bordered w-full"
          data-testid="delete-confirm-input"
          :disabled="isDeleting"
        />
      </div>

      <div v-if="error" class="alert alert-error mt-4" data-testid="delete-error">
        <span>{{ error }}</span>
      </div>

      <div class="modal-action">
        <button class="btn" :disabled="isDeleting" @click="closeModal">
          {{ $t('Cancel') }}
        </button>
        <button
          class="btn btn-error"
          data-testid="delete-confirm-button"
          :disabled="!canSubmit"
          @click="handleDelete"
        >
          <span v-if="isDeleting" class="loading loading-spinner loading-sm"></span>
          <span v-else>{{ $t('Delete account') }}</span>
        </button>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button :disabled="isDeleting">{{ $t('close') }}</button>
    </form>
  </dialog>
</template>

<script setup>
import { useUserStore } from '~/stores/user';
import { useAuthStore } from '~/stores/auth';
import LogoutButton from '~/components/profile/LogoutButton.vue';

const { t } = useI18n();
const userStore = useUserStore();
const authStore = useAuthStore();
const { api } = useApi();

const modal = ref(null);
const confirmInput = ref('');
const error = ref('');
const isDeleting = ref(false);

// Default to the password path if the flag hasn't loaded yet — safer than
// offering the weaker typed confirmation to a password account
const hasPassword = computed(() => userStore.user?.has_password !== false);

const canSubmit = computed(() => {
  if (isDeleting.value) return false;
  if (hasPassword.value) return confirmInput.value.length > 0;
  return confirmInput.value === 'DELETE';
});

const openModal = () => {
  confirmInput.value = '';
  error.value = '';
  modal.value?.showModal();
};

const closeModal = () => {
  modal.value?.close();
};

const handleDelete = async () => {
  error.value = '';
  isDeleting.value = true;

  try {
    const body = hasPassword.value
      ? { password: confirmInput.value }
      : { confirmation: confirmInput.value };

    await api('/api/user/me', { method: 'DELETE', body });

    // Account is gone server-side; clear all local state and leave
    await authStore.logout();
    await navigateTo('/login?deleted=1');
  } catch (err) {
    error.value = err?.data?.message || err?.message || t('Failed to delete account');
  } finally {
    isDeleting.value = false;
  }
};
</script>
