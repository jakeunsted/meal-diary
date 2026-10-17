<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a
      href="#main-content"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
    >
      {{ t('a11y.skipToContent') }}
    </a>
    <MarketingNav />
    <main id="main-content" class="flex-1" tabindex="-1">
      <slot />
    </main>
    <MarketingFooter />
  </div>
</template>
