<script setup lang="ts">
const { t } = useI18n();
const { webAppUrl } = useAppLinks();
const { trackWebAppCta } = useMarketingAnalytics();

const handleOpenApp = () => {
  trackWebAppCta('hero');
};
</script>

<template>
  <section class="relative overflow-hidden">
    <div class="marketing-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
    <div class="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div class="flex items-center gap-4 sm:gap-5">
        <img
          src="/logo.png"
          alt=""
          width="72"
          height="72"
          class="size-14 rounded-2xl shadow-lg shadow-brand-500/20 sm:size-[4.5rem]"
          decoding="async"
          aria-hidden="true"
        >
        <p class="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
          {{ t('home.hero.brand') }}
        </p>
      </div>
      <h1 class="mt-5 max-w-3xl text-2xl font-medium leading-snug text-ink-100 sm:text-3xl md:text-4xl">
        {{ t('home.hero.title') }}
      </h1>
      <p class="mt-5 max-w-2xl text-base leading-relaxed text-ink-300 sm:text-lg">
        {{ t('home.hero.subtitle') }}
      </p>
      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <UButton
          :to="webAppUrl('home_hero')"
          color="primary"
          size="xl"
          @click="handleOpenApp"
        >
          {{ t('home.hero.primaryCta') }}
        </UButton>
        <StoreCtaComingSoon placement="hero" />
      </div>
    </div>
  </section>
</template>
