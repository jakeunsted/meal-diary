<template>
  <div></div>
</template>

<script setup>
definePageMeta({
  layout: false,
  middleware: 'auth'
});

// Redirect based on authentication status
const authStore = useAuthStore();

onMounted(() => {
  if (authStore.isAuthenticated) {
    navigateTo('/diary');
  } else {
    navigateTo('/login');
  }
});
</script>