<template>
  <div class="min-h-screen bg-base-100">
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">{{ $t('Delete your Meal Diary account') }}</h1>
      </div>

      <!-- Signed in: delete directly on this page -->
      <template v-if="authStore.isAuthenticated">
        <p class="mb-4 leading-relaxed">
          {{ $t('You are signed in. You can delete your account below.') }}
        </p>
        <AccountSettings />
      </template>

      <!-- Signed out: explain every available path -->
      <template v-else>
        <h2 class="text-lg font-semibold mb-2">{{ $t('How to delete your account') }}</h2>
        <ul class="list-disc list-inside space-y-2 mb-6 leading-relaxed">
          <li>{{ $t('In the app: go to Profile and choose Delete account.') }}</li>
          <li>{{ $t('Or log in on this site and delete your account from this page.') }}</li>
        </ul>

        <NuxtLink class="btn btn-primary mb-8" to="/login" data-testid="login-link">
          {{ $t('Login') }}
        </NuxtLink>

        <div class="card bg-base-200 mb-8">
          <div class="card-body">
            <p>
              {{ $t('If you can no longer sign in, email us from the email address on your account and we will delete it for you:') }}
            </p>
            <a class="link link-primary" href="mailto:support@mealdiary.co.uk?subject=Account%20deletion%20request">
              support@mealdiary.co.uk
            </a>
          </div>
        </div>
      </template>

      <h2 class="text-lg font-semibold mb-2 mt-8">{{ $t('What gets deleted') }}</h2>
      <p class="leading-relaxed mb-6">
        {{ $t('Your account details (name, email, username, avatar) are permanently deleted, along with your analytics data. Meal plans, recipes, and shopping lists shared with a family group may remain with the group, with your name removed. Backups are purged within 30 days.') }}
      </p>

      <LegalLinks class="mt-8" />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
});

import { useAuthStore } from '~/stores/auth';
import { useUserStore } from '~/stores/user';
import AccountSettings from '~/components/profile/AccountSettings.vue';
import LegalLinks from '~/components/LegalLinks.vue';

const authStore = useAuthStore();
const userStore = useUserStore();

// No auth middleware on this page (Google Play requires it to be public),
// so initialize auth and load the user (for has_password) ourselves
onMounted(async () => {
  await authStore.initializeAuth();
  if (authStore.isAuthenticated && !userStore.user) {
    await userStore.fetchUser().catch(() => {});
  }
});
</script>
