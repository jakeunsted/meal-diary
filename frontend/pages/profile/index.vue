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
import { computed, onMounted } from 'vue';

const userStore = useUserStore();
const familyStore = useFamilyStore();
const { familyGroup, members: familyMembers, isLoading, error } = storeToRefs(familyStore);

const hasUserData = computed(() => !!userStore.user);
const hasFamilyData = computed(() => !!familyGroup.value);

const handleError = (error) => {
  console.error('Error in profile page:', error);
};

onMounted(() => {
  // Start loading data immediately without waiting
  const loadData = async () => {
    try {
      const [userData] = await Promise.all([
        userStore.fetchUser(),
        userStore.user?.family_group_id && Promise.all([
          familyStore.fetchMembers().catch(handleError),
          familyStore.fetchFamilyGroup().catch(handleError)
        ])
      ]);

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

  // Start loading data without waiting
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