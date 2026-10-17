<script setup lang="ts">
const { t } = useI18n();
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl as string;
const { webAppUrl } = useAppLinks();
const { trackWebAppCta } = useMarketingAnalytics();

useSeoMeta({
  title: () => t('features.recipes.seo.title'),
  description: () => t('features.recipes.seo.description'),
  ogTitle: () => t('features.recipes.seo.title'),
  ogDescription: () => t('features.recipes.seo.description'),
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/features/recipes` }],
});

const points = computed(() => [
  t('features.recipes.points.one'),
  t('features.recipes.points.two'),
  t('features.recipes.points.three'),
]);

const handleOpenApp = () => {
  trackWebAppCta('features_recipes');
};
</script>

<template>
  <div>
    <div class="mx-auto max-w-3xl px-4 pt-14 sm:px-6 lg:px-8 lg:pt-20">
      <p class="text-sm font-semibold uppercase tracking-wider text-brand-400">
        {{ t('nav.features') }}
      </p>
      <h1 class="mt-2 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        {{ t('features.recipes.title') }}
      </h1>
      <p class="mt-4 text-lg text-ink-300">
        {{ t('features.recipes.subtitle') }}
      </p>
      <p class="mt-6 text-base leading-relaxed text-ink-200">
        {{ t('features.recipes.body') }}
      </p>
      <ul class="mt-6 space-y-2 text-ink-200">
        <li v-for="(point, index) in points" :key="index" class="flex gap-2">
          <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
          <span>{{ point }}</span>
        </li>
      </ul>
      <div class="mt-8 flex flex-wrap gap-3">
        <UButton
          :to="webAppUrl('features_recipes')"
          color="primary"
          size="lg"
          @click="handleOpenApp"
        >
          {{ t('cta.openWebApp') }}
        </UButton>
        <UButton to="/pricing" color="neutral" variant="outline" size="lg">
          {{ t('cta.seePricing') }}
        </UButton>
      </div>
    </div>

    <ScreenshotSection
      :title="t('home.sections.recipes.title')"
      :body="t('home.sections.recipes.body')"
      src="/screenshots/recipes.png"
      :alt="t('features.recipes.alt')"
    />

    <ScreenshotSection
      :title="t('home.sections.import.title')"
      :body="t('home.sections.import.body')"
      src="/screenshots/import.png"
      :alt="t('features.recipes.importAlt')"
      reverse
    />
  </div>
</template>
