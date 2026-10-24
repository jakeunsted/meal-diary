<template>
  <div class="min-h-screen safe-top safe-bottom overflow-x-hidden">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <Toast />
  </div>
</template>

<script setup>
const authStore = useAuthStore();
const { initializeSSE, cleanupSSE } = useSSE();

// Initialize auth store.
// Route middleware also calls initializeAuth; the store single-flight guard
// prevents duplicate refresh attempts when both run on cold start.
onMounted(async () => {
  await authStore.initializeAuth();
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
