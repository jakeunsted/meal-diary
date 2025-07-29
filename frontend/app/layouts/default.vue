<template>
  <div class="pb-20">
    <slot />
    <BottomNavigator />
  </div>
</template>

<script setup>
import BottomNavigator from '~/components/nav/BottomNavigator.vue';
</script>