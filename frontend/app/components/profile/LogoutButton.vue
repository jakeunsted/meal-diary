<template>
  <button
    @click="handleLogout"
    class="btn btn-error w-full mt-8"
    :disabled="isLoading"
  >
    <span v-if="isLoading" class="loading loading-spinner"></span>
    <span v-else>Logout</span>
  </button>
</template>

<script setup>
import { ref } from 'vue';
import { useAuthStore } from '../../../stores/auth';
import { useRouter } from 'vue-router';

const authStore = useAuthStore();
const router = useRouter();
const isLoading = ref(false);

const handleLogout = async () => {
  try {
    isLoading.value = true;
    await authStore.logout();
    await router.push('/login');
  } catch (error) {
    console.error('Error during logout:', error);
  } finally {
    isLoading.value = false;
  }
};
</script>
