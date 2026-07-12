<script setup lang="ts">
defineProps<{
  tag: string
  title: string
  readTime: string
}>()
</script>

<template>
  <article class="overflow-hidden rounded-2xl bg-base-200 shadow-lg">
    <!-- ponytail: placeholder image block, swap for real asset -->
    <div class="flex h-28 items-center justify-center bg-base-300 text-sm text-neutral">📷 Blog image</div>
    <div class="p-4">
      <span class="inline-block rounded-md bg-indigo-950 px-2 py-1 text-xs font-semibold text-indigo-300">{{ tag }}</span>
      <h3 class="mt-3 text-sm font-bold text-white">{{ title }}</h3>
      <div class="mt-4 flex items-center gap-3 text-xs">
        <span class="text-neutral">{{ readTime }}</span>
        <span class="font-semibold text-success">Read →</span>
      </div>
    </div>
  </article>
</template>
