<template>
  <div class="dock dock-md">
    <button data-testid="nav-diary" :class="{ 'dock-active': isActive('/diary') }" @click="navigateTo('/diary')">
      <fa icon="house"></fa>
      <span class="dock-label">Home</span>
    </button>
    
    <button data-testid="nav-recipes" :class="{ 'dock-active': isActive('/recipes') }" @click="navigateTo('/recipes')">
      <fa icon="book-open"></fa>
      <span class="dock-label">Recipes</span>
    </button>

    <button data-testid="nav-shopping-list" :class="{ 'dock-active': isActive('/shopping-list') }" @click="navigateTo('/shopping-list')">
      <fa icon="list"></fa>
      <span class="dock-label">Shopping List</span>
    </button>
    
    <button data-testid="nav-profile" :class="{ 'dock-active': isActive('/profile') }" @click="navigateTo('/profile')">
      <fa icon="circle-user"></fa>
      <span class="dock-label">Profile</span>
    </button>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from '#app';

const route = useRoute();
const router = useRouter();

function isActive(path) {
  return route.path === path;
}

function navigateTo(path) {
  router.push(path);
}
</script>
