<template>
  <div>
    <slot />
    <button class="btn btn-primary">Primary</button>
    <BottomNavigator />
  </div>
</template>

<script setup>
import BottomNavigator from '~/components/nav/BottomNavigator.vue';
</script>