<template>
  <div class="min-h-screen bg-base-100">
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-2">
        <h1 class="text-2xl font-bold">{{ $t('Terms of Service') }}</h1>
        <button class="btn btn-ghost btn-sm" data-testid="back-button" @click="goBack">
          {{ $t('Back') }}
        </button>
      </div>
      <p class="text-sm opacity-70 mb-6">
        {{ $t('Last updated') }}: {{ $t('termsPage.lastUpdated') }}
      </p>

      <p class="mb-6 leading-relaxed">{{ $t('termsPage.intro') }}</p>

      <section v-for="(section, i) in sections" :key="i" class="mb-6">
        <h2 class="text-lg font-semibold mb-2">{{ rt(section.title) }}</h2>
        <p
          v-for="(paragraph, j) in section.body"
          :key="j"
          class="mb-2 leading-relaxed"
        >
          {{ rt(paragraph) }}
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-semibold mb-2">{{ $t('Contact us') }}</h2>
        <a class="link link-primary" href="mailto:support@mealdiary.co.uk">support@mealdiary.co.uk</a>
      </section>

      <LegalLinks class="mt-8" />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
});

import LegalLinks from '~/components/LegalLinks.vue';

const { tm, rt } = useI18n();
const sections = computed(() => tm('termsPage.sections'));

const goBack = () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigateTo('/login');
  }
};
</script>
