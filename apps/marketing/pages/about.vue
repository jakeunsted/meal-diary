<script setup lang="ts">
const { t } = useI18n();
const config = useRuntimeConfig();
const siteUrl = config.public.siteUrl as string;

useSeoMeta({
  title: () => t('about.seo.title'),
  description: () => t('about.seo.description'),
  ogTitle: () => t('about.seo.title'),
  ogDescription: () => t('about.seo.description'),
});

useHead({
  link: [{ rel: 'canonical', href: `${siteUrl}/about` }],
});

const faqItems = computed(() => [
  { id: 'what', question: t('about.faq.what.q'), answer: t('about.faq.what.a') },
  { id: 'who', question: t('about.faq.who.q'), answer: t('about.faq.who.a') },
  { id: 'stores', question: t('about.faq.stores.q'), answer: t('about.faq.stores.a') },
  { id: 'pricing', question: t('about.faq.pricing.q'), answer: t('about.faq.pricing.a') },
  { id: 'cookies', question: t('about.faq.cookies.q'), answer: t('about.faq.cookies.a') },
  { id: 'privacy', question: t('about.faq.privacy.q'), answer: t('about.faq.privacy.a') },
]);

const faqPageLd = computed(() => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.value.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}));
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
    <JsonLd :data="faqPageLd" />

    <header>
      <h1 class="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        {{ t('about.title') }}
      </h1>
      <p class="mt-4 text-lg text-ink-300">
        {{ t('about.subtitle') }}
      </p>
      <p class="mt-6 text-base leading-relaxed text-ink-200">
        {{ t('about.body') }}
      </p>
    </header>

    <section class="mt-14">
      <h2 class="font-display text-2xl font-semibold text-white sm:text-3xl">
        {{ t('about.faqTitle') }}
      </h2>
      <div class="mt-6">
        <FaqList :items="faqItems" />
      </div>
    </section>
  </div>
</template>
