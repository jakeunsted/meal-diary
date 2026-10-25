<template>
  <div class="flex flex-col items-center mb-8">
    <div v-if="isLoading" class="contents">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="alert alert-error w-full max-w-md">
      <i class="fas fa-exclamation-circle mr-2"></i>
      {{ error }}
    </div>
    <Transition v-else name="fade" mode="out-in">
      <div v-if="user" class="flex flex-col items-center w-full max-w-md">
        <div class="avatar mb-4">
          <div class="mask mask-squircle w-32 h-32 ring ring-primary ring-offset-base-100 ring-offset-2">
            <img :src="user.avatar_url || '/temp-avatars/generic-avatar.png'" class="w-full h-full object-cover" />
          </div>
        </div>
        <h2 class="text-2xl font-bold text-center mb-2">{{ fullName }}</h2>
        <button class="btn btn-primary mb-6" @click="showAvatarCustomizer = true">
          <fa icon="pen" class="mr-2" />
          {{ $t('Customize Avatar') }}
        </button>

        <div class="card bg-base-200 w-full">
          <div class="card-body gap-3">
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('Display name') }}</span>
              </label>
              <input
                type="text"
                v-model="displayName"
                class="input input-bordered"
                data-testid="profile-display-name-input"
                :disabled="isSavingDisplayName"
              />
            </div>
            <div class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('Email') }}</span>
              </label>
              <input
                type="email"
                v-model="emailDraft"
                class="input input-bordered"
                data-testid="profile-email-input"
                :disabled="isSavingEmail"
              />
            </div>
            <div v-if="emailCodeSent" class="form-control">
              <label class="label">
                <span class="label-text">{{ $t('Confirmation code') }}</span>
              </label>
              <input
                type="text"
                v-model="emailCode"
                inputmode="numeric"
                autocomplete="one-time-code"
                class="input input-bordered"
                data-testid="profile-email-code-input"
                :disabled="isSavingEmail"
              />
            </div>
            <div v-if="emailError" class="text-error text-sm" data-testid="profile-email-error">
              {{ emailError }}
            </div>
            <div v-if="emailSuccess" class="text-success text-sm" data-testid="profile-email-success">
              {{ emailSuccess }}
            </div>
            <button
              v-if="!emailCodeSent"
              class="btn btn-outline"
              data-testid="profile-email-send-code"
              :disabled="!canSendEmailCode"
              @click="handleRequestEmailChange"
            >
              <span v-if="isSavingEmail" class="loading loading-spinner loading-sm"></span>
              <span v-else>{{ $t('Send confirmation code') }}</span>
            </button>
            <button
              v-else
              class="btn btn-outline"
              data-testid="profile-email-confirm"
              :disabled="!canConfirmEmail"
              @click="handleConfirmEmailChange"
            >
              <span v-if="isSavingEmail" class="loading loading-spinner loading-sm"></span>
              <span v-else>{{ $t('Confirm email') }}</span>
            </button>
            <div v-if="displayNameError" class="text-error text-sm" data-testid="profile-display-name-error">
              {{ displayNameError }}
            </div>
            <div v-if="displayNameSuccess" class="text-success text-sm" data-testid="profile-display-name-success">
              {{ displayNameSuccess }}
            </div>
            <button
              class="btn btn-primary"
              data-testid="profile-save-display-name"
              :disabled="!canSaveDisplayName"
              @click="handleSaveDisplayName"
            >
              <span v-if="isSavingDisplayName" class="loading loading-spinner loading-sm"></span>
              <span v-else>{{ $t('Save') }}</span>
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <dialog id="avatar_customizer_modal" class="modal" :class="{ 'modal-open': showAvatarCustomizer }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">{{ $t('Customize Your Avatar') }}</h3>
        <AvatarCustomizer @close="showAvatarCustomizer = false" />
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showAvatarCustomizer = false">{{ $t('close') }}</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import type { User } from '../../types/User';
import { ref, watch, computed } from 'vue';
import AvatarCustomizer from './AvatarCustomizer.vue';
import { useUserStore } from '~/stores/user';
import { useAuthStore } from '~/stores/auth';
import { browserStorage } from '~/utils/browserStorage';

const showAvatarCustomizer = ref(false);
const userStore = useUserStore();
const { t } = useI18n();

const props = defineProps<{
  user: User | null;
  isLoading: boolean;
  error: string | null;
  fullName: string;
}>();

const displayName = ref('');
const isSavingDisplayName = ref(false);
const displayNameError = ref('');
const displayNameSuccess = ref('');
const emailDraft = ref('');
const emailCode = ref('');
const emailCodeSent = ref(false);
const isSavingEmail = ref(false);
const emailError = ref('');
const emailSuccess = ref('');

watch(
  () => props.user?.username,
  (username) => {
    displayName.value = username ?? '';
  },
  { immediate: true }
);

watch(
  () => props.user?.email,
  (email) => {
    emailDraft.value = email ?? '';
    emailCode.value = '';
    emailCodeSent.value = false;
  },
  { immediate: true }
);

const canSaveDisplayName = computed(() => {
  if (isSavingDisplayName.value) return false;
  const trimmed = displayName.value.trim();
  if (!trimmed) return false;
  return trimmed !== (props.user?.username ?? '');
});

const canSendEmailCode = computed(() => {
  if (isSavingEmail.value || emailCodeSent.value) return false;
  const trimmed = emailDraft.value.trim().toLowerCase();
  if (!trimmed) return false;
  return trimmed !== (props.user?.email ?? '').toLowerCase();
});

const canConfirmEmail = computed(() => {
  if (isSavingEmail.value || !emailCodeSent.value) return false;
  return emailCode.value.trim().length === 6;
});

const applyUpdatedUser = (updated: User) => {
  userStore.user = updated;
  userStore.lastFetchTime = Date.now();
  const authStore = useAuthStore();
  if (authStore.user) {
    authStore.user = { ...authStore.user, ...updated };
  }
  if (import.meta.client) {
    browserStorage.set('userData', JSON.stringify({
      user: updated,
      lastFetchTime: userStore.lastFetchTime,
    }));
    const raw = browserStorage.get('authState');
    if (raw) {
      const state = JSON.parse(raw);
      state.user = { ...state.user, ...updated };
      browserStorage.set('authState', JSON.stringify(state));
    }
  }
};

const handleRequestEmailChange = async () => {
  emailError.value = '';
  emailSuccess.value = '';
  isSavingEmail.value = true;
  try {
    const { api } = useApi();
    await api('/api/user/me/email-change', {
      method: 'POST',
      body: { email: emailDraft.value.trim() },
      silent: true,
    });
    emailCodeSent.value = true;
    emailSuccess.value = t('We sent a confirmation code to your new email address.');
  } catch (err: any) {
    emailError.value = err?.data?.message || t('Failed to update email');
  } finally {
    isSavingEmail.value = false;
  }
};

const handleConfirmEmailChange = async () => {
  emailError.value = '';
  emailSuccess.value = '';
  isSavingEmail.value = true;
  try {
    const { api } = useApi();
    const updated = await api<User>('/api/user/me/email-change/confirm', {
      method: 'POST',
      body: { code: emailCode.value.trim() },
      silent: true,
    });
    applyUpdatedUser(updated);
    emailSuccess.value = t('Email updated');
  } catch (err: any) {
    emailError.value = err?.data?.message || t('Failed to update email');
  } finally {
    isSavingEmail.value = false;
  }
};

const handleSaveDisplayName = async () => {
  displayNameError.value = '';
  displayNameSuccess.value = '';

  const trimmed = displayName.value.trim();
  if (!trimmed) {
    displayNameError.value = t('registration.errors.displayNameRequired');
    return;
  }

  isSavingDisplayName.value = true;
  try {
    await userStore.updateUser({ username: trimmed });
    displayNameSuccess.value = t('profilePage.displayNameUpdated');
  } catch (err) {
    displayNameError.value =
      err instanceof Error ? err.message : t('profilePage.displayNameUpdateFailed');
  } finally {
    isSavingDisplayName.value = false;
  }
};
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
