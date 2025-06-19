<template>
  <div v-if="!isRedirecting" class="min-h-screen flex items-center justify-center">
    <div class="loading loading-spinner loading-lg"></div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false,
  middleware: 'auth'
});

// Redirect based on authentication status
const authStore = useAuthStore();
const isRedirecting = ref(false);

// Wait for auth store to be initialized before redirecting
watch(() => authStore.isAuthenticated, async (isAuthenticated) => {
  if (isAuthenticated !== undefined) {
    isRedirecting.value = true;
    if (isAuthenticated) {
      await navigateTo('/diary');
    } else {
      await navigateTo('/login');
    }
  }
}, { immediate: true });
</script>