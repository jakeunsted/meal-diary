<script setup lang="ts">
const { public: { appUrl } } = useRuntimeConfig()

const navLinks = [
  { to: '/features', label: 'Features' },
  { to: '/how-it-works', label: 'How It Works' },
  { to: '/blog', label: 'Blog' },
]

const mobileOpen = ref(false)
</script>

<template>
  <header class="sticky top-0 z-50 bg-base-300 shadow-md">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
      <NuxtLink to="/" class="flex items-center gap-3">
        <span class="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-content">md</span>
        <span class="text-lg font-bold text-white">Meal Diary</span>
      </NuxtLink>

      <nav class="hidden items-center gap-10 lg:flex">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="text-sm font-medium text-base-content hover:text-white"
          active-class="text-white underline decoration-primary decoration-2 underline-offset-8"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="hidden items-center gap-3 lg:flex">
        <a :href="appUrl" class="rounded-lg bg-base-200 px-5 py-2.5 text-sm font-semibold text-indigo-300 hover:bg-base-200/70">Log in</a>
        <a :href="appUrl" class="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90">Start Free Trial</a>
      </div>

      <button
        class="text-2xl text-white lg:hidden"
        aria-label="Toggle menu"
        @click="mobileOpen = !mobileOpen"
      >
        ☰
      </button>
    </div>

    <div v-if="mobileOpen" class="border-t border-base-100 px-4 pb-4 lg:hidden">
      <nav class="flex flex-col gap-3 pt-3">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="py-1 text-sm font-medium text-base-content"
          @click="mobileOpen = false"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
      <div class="mt-3 flex flex-col gap-2">
        <a :href="appUrl" class="rounded-lg bg-base-200 px-5 py-2.5 text-center text-sm font-semibold text-indigo-300">Log in</a>
        <a :href="appUrl" class="rounded-lg bg-primary px-5 py-2.5 text-center text-sm font-semibold text-white">Start Free Trial</a>
      </div>
    </div>
  </header>
</template>
