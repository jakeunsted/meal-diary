<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <!-- Profile Header -->
    <div class="flex flex-col items-center mb-8">
      <div v-if="userStore.isLoading" class="flex justify-center">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      <div v-else-if="userStore.error" class="alert alert-error w-full max-w-md">
        {{ userStore.error }}
      </div>
      <div v-else-if="userStore.user" class="flex flex-col items-center">
        <div class="avatar mb-4">
          <div class="mask mask-squircle w-32 h-32 ring ring-primary ring-offset-base-100 ring-offset-2">
            <img :src="'/temp-avatars/avataaars1.png'" class="w-full h-full object-cover" />
          </div>
        </div>
        <h2 class="text-2xl font-bold text-center mb-2">{{ userStore.getFullName }}</h2>
      </div>
    </div>

    <!-- Family Details Card -->
    <div class="card bg-base-100 shadow-xl mb-8">
      <div class="card-header bg-base-200 px-6 py-4 rounded-t-lg">
        <h2 class="card-title text-xl font-bold">{{ $t('Your family details') }}</h2>
      </div>
      <div class="card-body rounded-b-lg">
        <div v-if="isLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <div v-else-if="error" class="alert alert-error">
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

    <!-- Family Members Card -->
    <div class="card bg-base-100 shadow-xl">
      <div class="card-header bg-base-200 px-6 py-4 rounded-t-lg">
        <h2 class="card-title text-xl font-bold">{{ $t('Your family members') }}</h2>
      </div>
      <div class="card-body rounded-b-lg">
        <div v-if="isLoading" class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
        <div v-else-if="error" class="alert alert-error">
          {{ error }}
        </div>
        <div v-else>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-6">
            <div v-for="member in familyMembers" :key="member.id" 
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
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
});

import { storeToRefs } from 'pinia';
import { useFamilyStore } from '~/stores/family';
import { useUserStore } from '~/stores/user';

const userStore = useUserStore();
const familyStore = useFamilyStore();
const { familyGroup, members: familyMembers, isLoading, error } = storeToRefs(familyStore);

onMounted(async () => {
  await userStore.fetchUser();
  await familyStore.fetchMembers();
  await familyStore.fetchFamilyGroup();
});

const addFamilyMember = () => {
  console.log('addFamilyMember');
};

const copyFamilyCode = async () => {
  if (familyGroup.value?.random_identifier) {
    try {
      await navigator.clipboard.writeText(familyGroup.value.random_identifier);
      // Show success toast
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-end';
      toast.innerHTML = `
        <div class="alert alert-success">
          <span>Family code copied to clipboard!</span>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
      // Show error toast
      const toast = document.createElement('div');
      toast.className = 'toast toast-top toast-end';
      toast.innerHTML = `
        <div class="alert alert-error">
          <span>Failed to copy family code</span>
        </div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  }
};
</script>