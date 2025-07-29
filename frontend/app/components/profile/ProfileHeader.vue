<template>
  <div class="flex flex-col items-center mb-8">
    <div v-if="isLoading" class="contents">
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
            <img :src="user.avatar_url || '/temp-avatars/generic-avatar.png'" class="w-full h-full object-cover" />
          </div>
        </div>
        <h2 class="text-2xl font-bold text-center mb-2">{{ fullName }}</h2>
        <button class="btn btn-primary" @click="showAvatarCustomizer = true">
          <fa icon="pen" class="mr-2" />
          Customize Avatar
        </button>
      </div>
    </Transition>

    <dialog id="avatar_customizer_modal" class="modal" :class="{ 'modal-open': showAvatarCustomizer }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Customize Your Avatar</h3>
        <AvatarCustomizer @close="showAvatarCustomizer = false" />
      </div>
      <form method="dialog" class="modal-backdrop">
        <button @click="showAvatarCustomizer = false">close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import type { User } from '../../types/User';
import { ref } from 'vue';
import AvatarCustomizer from './AvatarCustomizer.vue';

const showAvatarCustomizer = ref(false);

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