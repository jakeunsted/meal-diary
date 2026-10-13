<template>
  <div class="absolute inset-0 flex items-center justify-center bg-base-100">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
</template>

<script setup lang="ts">
import { initApplePopup } from '~/utils/appleSignIn';

definePageMeta({
  layout: false,
  middleware: []
});

onMounted(async () => {
  const clientId = useRuntimeConfig().public.appleServicesId;
  if (!clientId) {
    return;
  }

  try {
    await initApplePopup(clientId);
  } catch (error) {
    console.error('[Apple Auth] Popup page failed to initialise:', error);
  }
});
</script>
