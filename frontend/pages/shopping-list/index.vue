<template>
  <ShoppingListPhone v-if="!showWorkspace" />
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
});

import ShoppingListPhone from '~/components/shopping-list/ShoppingListPhone.vue';

const { showWorkspace } = useWorkspaceMode();
</script>
