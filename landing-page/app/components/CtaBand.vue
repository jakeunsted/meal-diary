<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  variant?: 'gradient' | 'solid'
}>(), {
  title: 'Ready to plan your first week together?',
  subtitle: 'Join couples across the UK. Free to start, cancel anytime.',
  variant: 'solid',
})

const { public: { appUrl } } = useRuntimeConfig()
</script>

<template>
  <section
    class="px-4 py-16 text-center sm:px-6 lg:px-8"
    :class="variant === 'gradient' ? 'bg-gradient-to-r from-indigo-600 to-violet-600' : 'bg-primary'"
  >
    <h2 class="text-3xl font-bold text-white sm:text-4xl">{{ title }}</h2>
    <p class="mx-auto mt-4 max-w-2xl text-lg text-indigo-200">{{ subtitle }}</p>
    <a
      :href="appUrl"
      class="mt-8 inline-block rounded-xl bg-success px-8 py-3.5 text-base font-bold text-success-content hover:opacity-90"
    >
      Start Your Free Trial →
    </a>
  </section>
</template>
