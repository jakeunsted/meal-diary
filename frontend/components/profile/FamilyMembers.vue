<template>
  <Transition name="fade" mode="out-in">
    <div class="card bg-base-100 shadow-xl">
      <div class="card-header bg-base-200 px-6 py-4 rounded-t-lg">
        <h2 class="card-title text-xl font-bold">{{ $t('Your family members') }}</h2>
      </div>
      <div class="card-body rounded-b-lg">
        <div v-if="isLoading" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <div v-for="i in 4" :key="i" class="flex flex-col items-center p-4 bg-base-200 rounded-xl">
            <div class="skeleton w-16 h-16 rounded-full mb-3"></div>
            <div class="skeleton h-4 w-24"></div>
          </div>
        </div>
        <div v-else-if="error" class="alert alert-error">
          <i class="fas fa-exclamation-circle mr-2"></i>
          {{ error }}
        </div>
        <div v-else>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
            <div v-for="member in members" :key="member.id" 
                class="flex flex-col items-center p-4 bg-base-200 rounded-xl hover:bg-base-300 transition-colors">
              <div class="avatar mb-3">
                <div class="w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
                  <img :src="member.avatar" class="w-full h-full object-cover" />
                </div>
              </div>
              <h3 class="font-semibold text-center">{{ member.name }}</h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { DisplayMember } from '~/types/FamilyGroup';

defineProps<{
  members: DisplayMember[];
  isLoading: boolean;
  error: string | null;
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

.skeleton {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .5;
  }
}
</style> 