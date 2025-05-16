<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup>
const mealDiaryStore = useMealDiaryStore();
const shoppingListStore = useShoppingListStore();
const userStore = useUserStore();

// Initialize stores when user is authenticated
watch(() => userStore.isAuthenticated, (isAuthenticated) => {
  if (isAuthenticated && userStore.user?.family_group_id) {
    mealDiaryStore.initialize();
    shoppingListStore.fetchShoppingList(userStore.user.family_group_id);
  }
}, { immediate: true });
</script>
