<template>
  <RecipesPhone v-if="!showWorkspace" />
</template>

<script setup>
definePageMeta({
  middleware: 'auth'
});

import RecipesPhone from '~/components/recipe/RecipesPhone.vue';

const { showWorkspace } = useWorkspaceMode();
</script>
