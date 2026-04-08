<template>
  <div class="min-h-screen safe-top safe-bottom">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toast />
  </div>
</template>

<script setup>
import { Capacitor } from '@capacitor/core';

const authStore = useAuthStore();
const { initializeSSE, cleanupSSE } = useSSE();

// Initialize auth store and Google Auth (for native platforms)
onMounted(async () => {
  await authStore.initializeAuth();

  // Initialize Google Auth early for native platforms
  if (Capacitor.isNativePlatform()) {
    const { initialize } = useGoogleAuth();
    await initialize();
  }
});

// Initialize SSE connection
initializeSSE();

// Cleanup SSE connection when app is unmounted
cleanupSSE();
</script>

<style>
.safe-top {
  padding-top: env(safe-area-inset-top);
}

.safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
</style>
