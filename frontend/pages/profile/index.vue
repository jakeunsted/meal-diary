<template>
  <div class="max-w-4xl mx-auto px-4 py-8">
    <ProfileHeader
      :user="userStore.user"
      :is-loading="!hasUserData"
      :error="userStore.error"
      :full-name="userStore.getFullName"
    />

    <FamilyDetails
      :family-group="familyGroup"
      :is-loading="!hasFamilyData"
      :error="error"
      @copy-code="copyFamilyCode"
    />

    <FamilyMembers
      :members="familyMembers"
      :is-loading="!hasFamilyData"
      :error="error"
    />

    <LogoutButton />
  </div>
</template>

<style scoped>
/* Add a fade-in for the entire page */
.max-w-4xl {
  animation: pageFadeIn 0.8s ease-out;
}

@keyframes pageFadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

<script setup>
definePageMeta({
  middleware: 'auth'
});

import { storeToRefs } from 'pinia';
import { useFamilyStore } from '~/stores/family';
import { useUserStore } from '~/stores/user';
import ProfileHeader from '~/components/profile/ProfileHeader.vue';
import FamilyDetails from '~/components/profile/FamilyDetails.vue';
import FamilyMembers from '~/components/profile/FamilyMembers.vue';
import LogoutButton from '~/components/profile/LogoutButton.vue';
import { computed, onMounted, nextTick } from 'vue';

const userStore = useUserStore();
const familyStore = useFamilyStore();
const { familyGroup, members: familyMembers, isLoading, error } = storeToRefs(familyStore);

const hasUserData = computed(() => !!userStore.user);
const hasFamilyData = computed(() => !!familyGroup.value);

const handleError = (error) => {
  console.error('Error in profile page:', error);
};

onMounted(async () => {
  await nextTick();
  
  // Start loading data after skeleton is visible
  const loadData = async () => {
    try {
      // Start all requests in parallel
      const [userData] = await Promise.all([
        userStore.fetchUser(),
        // If we have a family group ID in the store, start loading family data immediately
        userStore.user?.family_group_id && Promise.all([
          familyStore.fetchMembers().catch(handleError),
          familyStore.fetchFamilyGroup().catch(handleError)
        ])
      ]);

      // If we didn't have a family group ID before, load family data now
      if (!familyGroup.value && userData?.family_group_id) {
        await Promise.all([
          familyStore.fetchMembers().catch(handleError),
          familyStore.fetchFamilyGroup().catch(handleError)
        ]);
      }
    } catch (error) {
      handleError(error);
    }
  };

  // Start loading data
  loadData();
});

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