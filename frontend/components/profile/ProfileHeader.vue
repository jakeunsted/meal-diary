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
        <h2 class="text-2xl font-bold text-center mb-1">{{ fullName }}</h2>
        <p class="text-center text-base-content/70 mb-6 break-all" data-testid="profile-email">
          {{ user.email }}
        </p>
        <div class="flex flex-wrap justify-center gap-2">
          <button class="btn btn-primary" @click="showAvatarCustomizer = true">
            <fa icon="pen" class="mr-2" />
            {{ $t('Customize Avatar') }}
          </button>
          <button
            class="btn btn-outline"
            data-testid="profile-edit-account"
            @click="handleOpenAccountDetails"
          >
            {{ $t('Edit account') }}
          </button>
        </div>
      </div>
    </Transition>

    <dialog class="modal" :class="{ 'modal-open': showAccountDetails }" data-testid="profile-account-dialog">
      <div class="modal-box">
        <button
          type="button"
          class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          data-testid="profile-account-dialog-close"
          @click="handleCloseAccountDetails"
        >
          ✕
        </button>
        <h3 class="font-bold text-lg mb-4">{{ $t('Account details') }}</h3>

        <label class="flex flex-col gap-1">
          <span class="text-sm opacity-70">{{ $t('Display name') }}</span>
          <input
            type="text"
            v-model="displayName"
            class="input input-bordered w-full"
            data-testid="profile-display-name-input"
            :disabled="isSavingDisplayName"
          />
        </label>
        <div v-if="displayNameError" class="alert alert-error mt-3" data-testid="profile-display-name-error">
          <span>{{ displayNameError }}</span>
        </div>
        <div v-if="displayNameSuccess" class="alert alert-success mt-3" data-testid="profile-display-name-success">
          <span>{{ displayNameSuccess }}</span>
        </div>
        <div class="mt-3 flex justify-end">
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

        <div class="divider">{{ $t('Email') }}</div>

        <p class="break-all" data-testid="profile-account-current-email">{{ user?.email }}</p>
        <p v-if="!isChangingEmail && !emailSuccess" class="text-sm opacity-70 mt-1">
          {{ $t('A new address is saved only after that inbox confirms a code.') }}
        </p>
        <div v-if="emailError" class="alert alert-error mt-3" data-testid="profile-email-error">
          <span>{{ emailError }}</span>
        </div>
        <div v-if="emailSuccess" class="alert alert-success mt-3" data-testid="profile-email-success">
          <span>{{ emailSuccess }}</span>
        </div>

        <button
          v-if="!isChangingEmail"
          class="btn btn-outline mt-4"
          data-testid="profile-email-start"
          @click="handleStartEmailChange"
        >
          {{ $t('Change email') }}
        </button>

        <div v-else class="mt-4 flex flex-col gap-3">
          <p class="text-sm opacity-70">
            {{ $t('We will send a 6-digit code to the new address. This email stays until you confirm it.') }}
          </p>
          <label v-if="!emailCodeSent" class="flex flex-col gap-1">
            <span class="text-sm opacity-70">{{ $t('New email') }}</span>
            <input
              type="email"
              v-model="emailDraft"
              class="input input-bordered w-full"
              data-testid="profile-email-input"
              :disabled="isSavingEmail"
            />
          </label>
          <label v-else class="flex flex-col gap-1">
            <span class="text-sm opacity-70">{{ $t('Confirmation code') }}</span>
            <input
              type="text"
              v-model="emailCode"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              class="input input-bordered w-full tracking-widest"
              data-testid="profile-email-code-input"
              :disabled="isSavingEmail"
            />
          </label>
          <div class="flex justify-end gap-2">
            <button class="btn btn-ghost" :disabled="isSavingEmail" @click="handleCancelEmailChange">
              {{ $t('Cancel') }}
            </button>
            <button
              v-if="!emailCodeSent"
              class="btn btn-primary"
              data-testid="profile-email-send-code"
              :disabled="!canSendEmailCode"
              @click="handleRequestEmailChange"
            >
              <span v-if="isSavingEmail" class="loading loading-spinner loading-sm"></span>
              <span v-else>{{ $t('Send confirmation code') }}</span>
            </button>
            <button
              v-else
              class="btn btn-primary"
              data-testid="profile-email-confirm"
              :disabled="!canConfirmEmail"
              @click="handleConfirmEmailChange"
            >
              <span v-if="isSavingEmail" class="loading loading-spinner loading-sm"></span>
              <span v-else>{{ $t('Confirm email') }}</span>
            </button>
          </div>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" @click="handleCloseAccountDetails">{{ $t('close') }}</button>
      </form>
    </dialog>

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
const showAccountDetails = ref(false);
const isChangingEmail = ref(false);
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
    isChangingEmail.value = false;
  },
  { immediate: true }
);

const handleOpenAccountDetails = () => {
  displayName.value = props.user?.username ?? '';
  emailDraft.value = props.user?.email ?? '';
  emailCode.value = '';
  emailCodeSent.value = false;
  isChangingEmail.value = false;
  displayNameError.value = '';
  displayNameSuccess.value = '';
  emailError.value = '';
  emailSuccess.value = '';
  showAccountDetails.value = true;
};

const handleCloseAccountDetails = () => {
  showAccountDetails.value = false;
};

const handleStartEmailChange = () => {
  emailDraft.value = '';
  emailCode.value = '';
  emailCodeSent.value = false;
  emailError.value = '';
  emailSuccess.value = '';
  isChangingEmail.value = true;
};

const handleCancelEmailChange = () => {
  emailDraft.value = props.user?.email ?? '';
  emailCode.value = '';
  emailCodeSent.value = false;
  emailError.value = '';
  emailSuccess.value = '';
  isChangingEmail.value = false;
};

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
