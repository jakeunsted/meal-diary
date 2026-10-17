<script setup lang="ts">
import type { NuxtError } from '#app';

const props = defineProps<{
  error: NuxtError;
}>();

const { t } = useI18n();
const { webAppUrl } = useAppLinks();
const { trackWebAppCta } = useMarketingAnalytics();

useSeoMeta({
  title: () => t('error.title'),
  description: () => t('error.body'),
  ogTitle: () => t('error.title'),
  ogDescription: () => t('error.body'),
  robots: 'noindex, nofollow',
});

const handleHome = () => {
  clearError({ redirect: '/' });
};

const handleOpenApp = () => {
  trackWebAppCta('error_404');
};
</script>

<template>
  <div class="flex min-h-screen flex-col bg-ink-950">
    <MarketingNav />
    <main class="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-20 text-center">
      <p class="text-sm font-semibold uppercase tracking-wider text-brand-400">
        {{ props.error?.statusCode || 404 }}
      </p>
      <h1 class="mt-3 font-display text-4xl font-semibold text-white">
        {{ t('error.title') }}
      </h1>
      <p class="mt-4 text-ink-300">
        {{ t('error.body') }}
      </p>
      <div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <UButton color="primary" size="lg" @click="handleHome">
          {{ t('error.home') }}
        </UButton>
        <UButton
          :to="webAppUrl('error_404')"
          color="neutral"
          variant="outline"
          size="lg"
          @click="handleOpenApp"
        >
          {{ t('error.openApp') }}
        </UButton>
      </div>
    </main>
    <MarketingFooter />
  </div>
</template>
