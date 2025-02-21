<template>
  <div class="dock dock-md">
    <button :class="{ 'dock-active': isActive('/') }" @click="navigateTo('/')">
      <fa icon="house"></fa>
      <span class="dock-label">Home</span>
    </button>
    
    <button :class="{ 'dock-active': isActive('/shopping-list') }" @click="navigateTo('/shopping-list')">
      <fa icon="list"></fa>
      <span class="dock-label">Shopping List</span>
    </button>
    
    <button :class="{ 'dock-active': isActive('/profile') }" @click="navigateTo('/profile')">
      <fa icon="circle-user"></fa>
      <span class="dock-label">Profile</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from '#app';

const route = useRoute();
const router = useRouter();

function isActive(path: string): boolean {
  return route.path === path;
}

function navigateTo(path: string) {
  router.push(path);
}
</script>
