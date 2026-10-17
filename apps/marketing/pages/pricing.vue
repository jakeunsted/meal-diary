<script setup lang="ts">
const { t } = useI18n();
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl as string;

useSeoMeta({
  title: () => t('pricing.seo.title'),
  description: () => t('pricing.seo.description'),
  ogTitle: () => t('pricing.seo.title'),
  ogDescription: () => t('pricing.seo.description'),
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/pricing` }],
});
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
    <header class="max-w-2xl">
      <h1 class="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        {{ t('pricing.title') }}
      </h1>
      <p class="mt-4 text-lg text-ink-300">
        {{ t('pricing.subtitle') }}
      </p>
    </header>

    <div class="mt-12">
      <PricingSummary />
    </div>
  </div>
</template>
