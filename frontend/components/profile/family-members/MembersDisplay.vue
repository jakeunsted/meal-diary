<template>
  <div v-if="members.length > 0">
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
      <div v-for="member in members" :key="member.id" 
        class="flex flex-col items-center p-4 bg-base-200 rounded-xl hover:bg-base-300 transition-colors">
        <div class="avatar mb-3">
          <div class="w-16 h-16 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
            <img 
              :src="member.avatar_url || '/temp-avatars/generic-avatar.png'" 
              :alt="member.name"
              class="w-12 h-12 rounded-full object-cover"
            />
          </div>
        </div>
        <h3 class="font-semibold text-center">{{ member.name }}</h3>
      </div>
    </div>
  </div>
  <div v-else class="flex flex-col items-center justify-center mx-auto p-4 rounded-xl">
    <h3 class="font-semibold">{{ $t('Wow its empty here!') }}</h3>
    <button class="btn btn-primary mt-4" @click="handleAddFamilyMember">{{ $t('Add family member') }}</button>
  </div>
</template>

<script setup lang="ts">
import type { DisplayMember } from '../../../types/FamilyGroup';

defineProps<{
  members: DisplayMember[];
}>();

const emit = defineEmits<{
  (e: 'addFamilyMember'): void;
}>();

const handleAddFamilyMember = () => {
  emit('addFamilyMember');
};
</script>

<script lang="ts">
export default {
  name: 'MembersDisplay',
};
</script>