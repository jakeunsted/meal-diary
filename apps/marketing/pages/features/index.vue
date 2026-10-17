<script setup lang="ts">
const { t } = useI18n();
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl as string;
const { webAppUrl } = useAppLinks();
const { trackWebAppCta, trackNavClick } = useMarketingAnalytics();

useSeoMeta({
  title: () => t('features.hub.seo.title'),
  description: () => t('features.hub.seo.description'),
  ogTitle: () => t('features.hub.seo.title'),
  ogDescription: () => t('features.hub.seo.description'),
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/features` }],
});

const cards = computed(() => [
  {
    key: 'diary',
    to: '/features/meal-diary',
    title: t('features.hub.cards.diary.title'),
    body: t('features.hub.cards.diary.body'),
  },
  {
    key: 'recipes',
    to: '/features/recipes',
    title: t('features.hub.cards.recipes.title'),
    body: t('features.hub.cards.recipes.body'),
  },
  {
    key: 'shopping',
    to: '/features/shopping-list',
    title: t('features.hub.cards.shopping.title'),
    body: t('features.hub.cards.shopping.body'),
  },
]);

const handleCardClick = (key: string) => {
  trackNavClick(`features_${key}`);
};

const handleOpenApp = () => {
  trackWebAppCta('features_hub');
};
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
    <header class="max-w-2xl">
      <h1 class="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        {{ t('features.hub.title') }}
      </h1>
      <p class="mt-4 text-lg text-ink-300">
        {{ t('features.hub.subtitle') }}
      </p>
    </header>

    <div class="mt-12 grid gap-6 md:grid-cols-3">
      <NuxtLink
        v-for="card in cards"
        :key="card.key"
        :to="card.to"
        class="group rounded-2xl border border-white/10 bg-ink-900/80 p-6 shadow-sm transition hover:border-brand-400 hover:shadow-md"
        @click="handleCardClick(card.key)"
      >
        <h2 class="font-display text-xl font-semibold text-white group-hover:text-brand-300">
          {{ card.title }}
        </h2>
        <p class="mt-3 text-sm leading-relaxed text-ink-300">
          {{ card.body }}
        </p>
      </NuxtLink>
    </div>

    <div class="mt-12">
      <UButton
        :to="webAppUrl('features_hub')"
        color="primary"
        size="lg"
        @click="handleOpenApp"
      >
        {{ t('cta.openWebApp') }}
      </UButton>
    </div>
  </div>
</template>
