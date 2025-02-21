<template>
  <div>
    <slot />
    <BottomNavigator />
  </div>
</template>

<script setup>
import BottomNavigator from '~/components/nav/BottomNavigator.vue';
</script>