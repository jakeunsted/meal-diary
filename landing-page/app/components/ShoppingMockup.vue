<script setup lang="ts">
const groups = [
  { label: '🥦 Produce', items: ['Broccoli', 'Tomatoes', 'Spinach'] },
  { label: '🥩 Meat', items: ['Chicken thighs', 'Minced beef'] },
  { label: '🥫 Pantry', items: ['Coconut milk', 'Rice'] },
]
</script>

<template>
  <div class="w-full max-w-[520px] overflow-hidden rounded-2xl bg-base-300 shadow-2xl">
    <div class="px-6 pt-5">
      <p class="text-xl font-bold text-white">Shopping List</p>
    </div>

    <div class="mt-4 px-4">
      <div class="flex items-center gap-2 rounded-md border border-base-200 bg-base-100 px-3 py-2">
        <span class="flex size-5 items-center justify-center rounded bg-primary text-xs font-bold text-white">+</span>
        <span class="text-sm text-neutral">Enter new item</span>
      </div>
    </div>

    <div class="mt-3 space-y-3 px-4 pb-5">
      <div v-for="group in groups" :key="group.label">
        <p class="text-sm font-semibold text-white">{{ group.label }}</p>
        <ul class="mt-1.5 divide-y divide-base-200">
          <li v-for="item in group.items" :key="item" class="flex items-center gap-2 py-1.5">
            <span class="size-3.5 rounded-full border border-neutral" />
            <span class="text-sm text-base-content">{{ item }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
