<script setup lang="ts">
defineProps<{
  number: number
  title: string
  description: string
}>()
</script>

<template>
  <div class="text-center">
    <div class="mx-auto flex size-13 items-center justify-center rounded-full bg-primary text-xl font-bold text-white">
      {{ number }}
    </div>
    <h3 class="mt-4 text-base font-bold text-base-content">{{ title }}</h3>
    <p class="mx-auto mt-2 max-w-xs text-sm text-base-content">{{ description }}</p>
  </div>
</template>
