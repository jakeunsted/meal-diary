<template>
  <div>
    <h1>Logging out...</h1>
  </div>
</template>

<script setup>
const { logout } = useAuth();

onMounted(async () => {
  await logout();
  navigateTo('/login');
});
</script>