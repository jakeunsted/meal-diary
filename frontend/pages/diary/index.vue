<template>
  <DiaryPhone v-if="!showWorkspace" />
</template>

<script setup>
definePageMeta({
  middleware: 'auth'
});

import DiaryPhone from '~/components/diary/DiaryPhone.vue';

const { showWorkspace } = useWorkspaceMode();
</script>
