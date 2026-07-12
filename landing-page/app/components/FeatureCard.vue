<script setup lang="ts">
defineProps<{
  icon: string
  title: string
  description: string
}>()
</script>

<template>
  <div class="rounded-2xl bg-base-300 p-6 shadow-lg">
    <div class="flex size-14 items-center justify-center rounded-2xl bg-base-200 text-3xl">{{ icon }}</div>
    <h3 class="mt-6 text-xl font-bold text-white">{{ title }}</h3>
    <p class="mt-3 text-[15px] leading-relaxed text-base-content">{{ description }}</p>
    <p class="mt-6 text-sm font-semibold text-success">Learn more →</p>
  </div>
</template>
