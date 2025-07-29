<template>
  <div class="flex justify-center items-center h-screen">
    <div class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
      <h1 class="mt-4">{{ $t('Logging out...') }}</h1>
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false,
  middleware: false // Disable auth middleware for logout page
});

import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();

onMounted(async () => {
  await authStore.clearAuth();
  await navigateTo('/login', { replace: true });
});
</script>