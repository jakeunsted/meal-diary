<script setup lang="ts">
const { t } = useI18n();
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl as string;
const { webAppUrl } = useAppLinks();
const { trackWebAppCta } = useMarketingAnalytics();

useSeoMeta({
  title: () => t('home.seo.title'),
  description: () => t('home.seo.description'),
  ogTitle: () => t('home.seo.title'),
  ogDescription: () => t('home.seo.description'),
  ogType: 'website',
  ogUrl: siteUrl,
  ogImage: `${siteUrl}/og-image.png`,
  twitterCard: 'summary',
  twitterImage: `${siteUrl}/og-image.png`,
});

useHead({
  link: [{ rel: 'canonical', href: siteUrl }],
});

const softwareApplicationLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Meal Diary',
  applicationCategory: 'LifestyleApplication',
  operatingSystem: 'Web',
  url: siteUrl,
  description: t('home.seo.description'),
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'GBP',
    description: 'Free plan available; Family Plus in the web app',
  },
};

const handleFinalCta = () => {
  trackWebAppCta('home_final');
};
</script>

<template>
  <div>
    <JsonLd :data="softwareApplicationLd" />
    <Hero />

    <section class="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6 lg:px-8">
      <h2 class="font-display text-3xl font-semibold text-white sm:text-4xl">
        {{ t('home.story.title') }}
      </h2>
      <p class="mt-4 text-base leading-relaxed text-ink-300 sm:text-lg">
        {{ t('home.story.body') }}
      </p>
    </section>

    <ScreenshotSection
      :title="t('home.sections.diary.title')"
      :body="t('home.sections.diary.body')"
      src="/screenshots/diary.png"
      :alt="t('home.sections.diary.alt')"
    />

    <ScreenshotSection
      :title="t('home.sections.recipes.title')"
      :body="t('home.sections.recipes.body')"
      src="/screenshots/recipes.png"
      :alt="t('home.sections.recipes.alt')"
      reverse
    />

    <ScreenshotSection
      :title="t('home.sections.import.title')"
      :body="t('home.sections.import.body')"
      src="/screenshots/import.png"
      :alt="t('home.sections.import.alt')"
    />

    <ScreenshotSection
      :title="t('home.sections.shopping.title')"
      :body="t('home.sections.shopping.body')"
      src="/screenshots/shopping.png"
      :alt="t('home.sections.shopping.alt')"
      reverse
    />

    <section class="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 lg:px-8">
      <h2 class="font-display text-3xl font-semibold text-white">
        {{ t('home.sharing.title') }}
      </h2>
      <p class="mt-4 text-base leading-relaxed text-ink-300 sm:text-lg">
        {{ t('home.sharing.body') }}
      </p>
    </section>

    <section class="border-y border-white/10 bg-ink-900/50">
      <div class="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6 lg:px-8">
        <h2 class="font-display text-2xl font-semibold text-white sm:text-3xl">
          {{ t('home.trust.title') }}
        </h2>
        <p class="mt-4 text-base leading-relaxed text-ink-300">
          {{ t('home.trust.body') }}
        </p>
      </div>
    </section>

    <section class="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
      <h2 class="font-display text-3xl font-semibold text-white sm:text-4xl">
        {{ t('home.finalCta.title') }}
      </h2>
      <p class="mt-4 text-base text-ink-300 sm:text-lg">
        {{ t('home.finalCta.body') }}
      </p>
      <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <UButton
          :to="webAppUrl('home_final')"
          color="primary"
          size="xl"
          @click="handleFinalCta"
        >
          {{ t('cta.openWebApp') }}
        </UButton>
        <StoreCtaComingSoon placement="home_final" />
      </div>
    </section>
  </div>
</template>
