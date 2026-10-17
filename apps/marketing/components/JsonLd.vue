<script setup lang="ts">
interface Props {
  data: Record<string, unknown> | Record<string, unknown>[];
}

const props = defineProps<Props>();

useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      children: JSON.stringify(props.data),
    },
  ],
}));
</script>

<template>
  <span class="hidden" aria-hidden="true" />
</template>
