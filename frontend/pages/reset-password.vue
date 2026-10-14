<template>
  <div class="absolute inset-0 flex items-center justify-center bg-base-100">
    <div class="card w-96 bg-base-200 shadow-xl">
      <div class="card-body">
        <div class="card-title">
          <h1>{{ $t('Reset password') }}</h1>
        </div>
        <hr />
        <p class="text-sm opacity-70">
          {{ $t('Choose a new password for your account.') }}
        </p>

        <a
          v-if="openInApp"
          class="btn btn-outline w-full"
          data-testid="open-in-app-link"
          :href="appResetUrl"
        >
          {{ $t('Open in the Meal Diary app') }}
        </a>

        <form class="space-y-4" data-testid="reset-password-form" @submit.prevent="handleResetPassword">
          <div class="form-control">
            <label class="label">
              <span class="label-text">{{ $t('New password') }}</span>
            </label>
            <input
              v-model="password"
              type="password"
              class="input input-bordered"
              data-testid="reset-password-input"
              :disabled="isLoading || !token"
              required
            />
            <ul class="mt-2 space-y-1 text-sm" data-testid="password-requirements">
              <li
                v-for="requirement in passwordRequirementResults"
                :key="requirement.id"
                class="flex items-center gap-2"
                :class="requirement.met ? 'text-success' : 'opacity-60'"
              >
                <span aria-hidden="true">{{ requirement.met ? '✓' : '○' }}</span>
                <span>{{ $t(`registration.passwordRequirements.${requirement.id}`) }}</span>
              </li>
            </ul>
          </div>
          <div class="form-control">
            <label class="label">
              <span class="label-text">{{ $t('Confirm password') }}</span>
            </label>
            <input
              v-model="confirmPassword"
              type="password"
              class="input input-bordered"
              data-testid="reset-confirm-password-input"
              :disabled="isLoading || !token"
              required
            />
          </div>
          <div v-if="error" class="alert alert-error" data-testid="reset-password-error">
            <span>{{ error }}</span>
          </div>
          <button
            type="submit"
            class="btn btn-primary w-full"
            data-testid="reset-password-submit-button"
            :disabled="isLoading || !token"
          >
            <span v-if="isLoading" class="loading loading-spinner"></span>
            <span v-else>{{ $t('Reset password') }}</span>
          </button>
          <div class="text-center">
            <NuxtLink class="link link-hover link-primary" to="/login">
              {{ $t('Back to login') }}
            </NuxtLink>
          </div>
        </form>
        <LegalLinks class="mt-4" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: false,
  middleware: ['auth']
});

import { evaluatePassword, isPasswordValid } from '@meal-diary/shared';
import LegalLinks from '~/components/LegalLinks.vue';

const route = useRoute();
const { t } = useI18n();

const token = computed(() => {
  const value = route.query.token;
  return typeof value === 'string' ? value : '';
});

const openInApp = computed(() => route.query.client === 'app' && token.value.length > 0);
const appResetUrl = computed(() => `mealdiary://reset-password?token=${encodeURIComponent(token.value)}`);

const isPhoneClient = (): boolean => {
  if (!import.meta.client) {
    return false;
  }
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
};

const password = ref('');
const confirmPassword = ref('');
const error = ref('');
const isLoading = ref(false);
const passwordRequirementResults = computed(() => evaluatePassword(password.value));

const readErrorMessage = (caught: unknown, fallback: string): string => {
  if (typeof caught === 'object' && caught !== null) {
    const record = caught as {
      data?: { message?: string };
      statusMessage?: string;
      message?: string;
    };
    return record.data?.message || record.statusMessage || record.message || fallback;
  }
  return fallback;
};

const handleResetPassword = async () => {
  error.value = '';
  if (!token.value) {
    error.value = t('Reset link is invalid or has expired');
    return;
  }
  if (!isPasswordValid(password.value)) {
    error.value = t('registration.errors.passwordRequirements');
    return;
  }
  if (password.value !== confirmPassword.value) {
    error.value = t('registration.errors.passwordMismatch');
    return;
  }

  isLoading.value = true;
  try {
    await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token: token.value, password: password.value },
    });
    await navigateTo('/login?reset=1');
  } catch (caught) {
    error.value = readErrorMessage(caught, t('Unable to reset password'));
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  if (openInApp.value && isPhoneClient()) {
    window.location.href = appResetUrl.value;
  }
});

watch(token, (value) => {
  if (!value) {
    error.value = t('Reset link is invalid or has expired');
    return;
  }
  if (error.value === t('Reset link is invalid or has expired')) {
    error.value = '';
  }
}, { immediate: true });
</script>
