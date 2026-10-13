<template>
  <div class="absolute inset-0 flex items-center justify-center bg-base-100">
    <div class="card w-96 bg-base-200 shadow-xl">
      <div class="card-body">
        <div class="card-title">
          <h1>{{ $t('Forgot password') }}</h1>
        </div>
        <hr />
        <p class="text-sm opacity-70">
          {{ $t('Enter the email on your account and we will send reset instructions.') }}
        </p>

        <form class="space-y-4" data-testid="forgot-password-form" @submit.prevent="handleForgotPassword">
          <div class="form-control">
            <label class="label">
              <span class="label-text">{{ $t('Email') }}</span>
            </label>
            <input
              v-model="email"
              type="email"
              placeholder="your@email.com"
              class="input input-bordered"
              data-testid="forgot-password-email-input"
              :disabled="isLoading || submitted"
              required
            />
          </div>
          <div v-if="error" class="alert alert-error" data-testid="forgot-password-error">
            <span>{{ error }}</span>
          </div>
          <div v-if="submitted" class="alert alert-success" data-testid="forgot-password-success">
            <span>{{ $t('If an account exists for that email, we sent password reset instructions.') }}</span>
          </div>
          <button
            type="submit"
            class="btn btn-primary w-full"
            data-testid="forgot-password-submit-button"
            :disabled="isLoading || submitted"
          >
            <span v-if="isLoading" class="loading loading-spinner"></span>
            <span v-else>{{ $t('Send reset link') }}</span>
          </button>
          <div class="text-center">
            <NuxtLink class="link link-hover link-primary" to="/login" data-testid="back-to-login-link">
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

import { isValidEmail } from '@meal-diary/shared';
import LegalLinks from '~/components/LegalLinks.vue';

const { t } = useI18n();
const email = ref('');
const error = ref('');
const isLoading = ref(false);
const submitted = ref(false);

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

const handleForgotPassword = async () => {
  error.value = '';
  if (!isValidEmail(email.value.trim())) {
    error.value = t('Please enter a valid email address');
    return;
  }

  isLoading.value = true;
  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: email.value.trim() },
    });
    submitted.value = true;
  } catch (caught) {
    error.value = readErrorMessage(caught, t('Unable to send reset email'));
  } finally {
    isLoading.value = false;
  }
};
</script>
