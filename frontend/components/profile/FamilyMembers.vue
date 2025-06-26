<template>
  <Transition name="fade" mode="out-in">
    <div class="card bg-base-100 shadow-xl">
      <div class="card-header bg-base-200 px-6 py-4 rounded-t-lg">
        <h2 class="card-title text-xl font-bold">{{ $t('Your family members') }}</h2>
      </div>
      <div class="card-body rounded-b-lg">
        <div v-if="isLoading">
          <MemberSkeleton />
        </div>
        <div v-else-if="error" class="alert alert-error">
          <i class="fas fa-exclamation-circle mr-2"></i>
          {{ error }}
        </div>
        <div v-else>
          <MembersDisplay :members="members" @addFamilyMember="$emit('addFamilyMember')" />
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { DisplayMember } from '../../types/FamilyGroup';

import { default as MemberSkeleton } from './family-members/MemberSkeleton.vue';
import { default as MembersDisplay } from './family-members/MembersDisplay.vue';

defineProps<{
  members: DisplayMember[];
  isLoading: boolean;
  error: string | null;
}>();

defineEmits<{
  (e: 'addFamilyMember'): void;
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

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .5;
  }
}
</style> 