<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
const authStore = useAuthStore();
const mealDiaryStore = useMealDiaryStore();
const shoppingListStore = useShoppingListStore();
const userStore = useUserStore();

// Initialize auth store
onMounted(async () => {
  await authStore.initializeAuth();
});

// Initialize stores when user is authenticated
watch(() => userStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated && userStore.user?.family_group_id) {
    mealDiaryStore.initialize();
    shoppingListStore.fetchShoppingList(userStore.user.family_group_id);
  }
}, { immediate: true });
</script>
