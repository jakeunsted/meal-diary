<script setup lang="ts">
const columns = [
  { href: '/features', label: 'Features' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/blog', label: 'Blog' },
  { href: '#', label: 'Privacy Policy' },
  { href: '#', label: 'Terms' },
]
</script>

<template>
  <footer class="border-t border-base-200 bg-base-100">
    <div class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div class="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-xl font-bold text-white">Meal Diary</p>
          <p class="mt-2 text-sm text-neutral">Meal planning, made for couples.</p>
        </div>
        <nav class="flex flex-wrap gap-x-8 gap-y-2">
          <a
            v-for="col in columns"
            :key="col.label"
            :href="col.href"
            class="text-sm font-medium text-neutral hover:text-base-content"
          >
            {{ col.label }}
          </a>
        </nav>
      </div>
      <p class="mt-10 text-xs text-neutral-content">© 2026 Meal Diary. All rights reserved.</p>
    </div>
  </footer>
</template>
