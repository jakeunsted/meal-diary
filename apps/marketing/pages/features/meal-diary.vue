<script setup lang="ts">
const { t } = useI18n();
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl as string;
const { webAppUrl } = useAppLinks();
const { trackWebAppCta } = useMarketingAnalytics();

useSeoMeta({
  title: () => t('features.diary.seo.title'),
  description: () => t('features.diary.seo.description'),
  ogTitle: () => t('features.diary.seo.title'),
  ogDescription: () => t('features.diary.seo.description'),
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/features/meal-diary` }],
});

const points = computed(() => [
  t('features.diary.points.one'),
  t('features.diary.points.two'),
  t('features.diary.points.three'),
]);

const handleOpenApp = () => {
  trackWebAppCta('features_diary');
};
</script>

<template>
  <div>
    <div class="mx-auto max-w-3xl px-4 pt-14 sm:px-6 lg:px-8 lg:pt-20">
      <p class="text-sm font-semibold uppercase tracking-wider text-brand-400">
        {{ t('nav.features') }}
      </p>
      <h1 class="mt-2 font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        {{ t('features.diary.title') }}
      </h1>
      <p class="mt-4 text-lg text-ink-300">
        {{ t('features.diary.subtitle') }}
      </p>
      <p class="mt-6 text-base leading-relaxed text-ink-200">
        {{ t('features.diary.body') }}
      </p>
      <ul class="mt-6 space-y-2 text-ink-200">
        <li v-for="(point, index) in points" :key="index" class="flex gap-2">
          <span class="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-600" aria-hidden="true" />
          <span>{{ point }}</span>
        </li>
      </ul>
      <div class="mt-8 flex flex-wrap gap-3">
        <UButton
          :to="webAppUrl('features_diary')"
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
      :title="t('home.sections.diary.title')"
      :body="t('home.sections.diary.body')"
      src="/screenshots/diary.png"
      :alt="t('features.diary.alt')"
    />
  </div>
</template>
