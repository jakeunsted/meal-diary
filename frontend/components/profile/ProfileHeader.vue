<template>
  <div class="flex flex-col items-center mb-8">
    <div v-if="isLoading" class="flex justify-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="alert alert-error w-full max-w-md">
      <i class="fas fa-exclamation-circle mr-2"></i>
      {{ error }}
    </div>
    <Transition v-else name="fade" mode="out-in">
      <div v-if="user" class="flex flex-col items-center">
        <div class="avatar mb-4">
          <div class="mask mask-squircle w-32 h-32 ring ring-primary ring-offset-base-100 ring-offset-2">
            <img :src="'/temp-avatars/avataaars1.png'" class="w-full h-full object-cover" />
          </div>
        </div>
        <h2 class="text-2xl font-bold text-center mb-2">{{ fullName }}</h2>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import type { User } from '~/types/User';

defineProps<{
  user: User | null;
  isLoading: boolean;
  error: string | null;
  fullName: string;
}>();
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style> 