<template>
  <Transition name="fade" mode="out-in">
    <div class="card bg-base-100 shadow-xl mb-8">
      <div class="card-header bg-base-200 px-6 py-4 rounded-t-lg">
        <h2 class="card-title text-xl font-bold">{{ $t('Your family details') }}</h2>
      </div>
      <div class="card-body rounded-b-lg">
        <div v-if="isLoading" class="flex flex-col items-center space-y-6 py-4">
          <div class="skeleton h-4 w-32"></div>
          <div class="skeleton h-4 w-48"></div>
          <div class="skeleton h-4 w-40"></div>
        </div>
        <div v-else-if="error" class="alert alert-error">
          <i class="fas fa-exclamation-circle mr-2"></i>
          {{ error }}
        </div>
        <div v-else-if="familyGroup" class="flex flex-col items-center text-center">
          <div class="max-w-md space-y-6">
            <div class="space-y-2">
              <h3 class="font-semibold text-lg">{{ $t('Family group name') }}</h3>
              <p class="text-base-content/80">{{ familyGroup.name }}</p>
            </div>
            <div class="space-y-4">
              <div>
                <h3 class="font-semibold text-lg">{{ $t('Family group code') }}</h3>
                <div class="flex items-center justify-center gap-2 mt-2">
                  <code 
                    @click="copyFamilyCode" 
                    class="bg-base-300 px-3 py-2 rounded-lg font-mono cursor-pointer hover:bg-base-400 transition-colors flex items-center gap-2"
                  >
                    {{ familyGroup.random_identifier }}
                    <fa icon="copy" class="text-sm opacity-70" />
                  </code>
                </div>
              </div>
              <p class="text-sm text-base-content/70">
                {{ $t('Share this code with new users to join your family group') }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { FamilyGroup } from '~/types/FamilyGroup';

defineProps<{
  familyGroup: FamilyGroup | null;
  isLoading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  (e: 'copyCode'): void;
}>();

const copyFamilyCode = () => {
  emit('copyCode');
};
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