<template>
  <div class="min-h-screen bg-base-100">
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-2">
        <h1 class="text-2xl font-bold">{{ $t('Privacy Policy') }}</h1>
        <button class="btn btn-ghost btn-sm" data-testid="back-button" @click="goBack">
          {{ $t('Back') }}
        </button>
      </div>
      <p class="text-sm opacity-70 mb-6">
        {{ $t('Last updated') }}: {{ privacyPage.lastUpdated }}
      </p>

      <p class="mb-6 leading-relaxed">{{ privacyPage.intro }}</p>

      <section v-for="(section, i) in privacyPage.sections" :key="i" class="mb-6">
        <h2 class="text-lg font-semibold mb-2">{{ section.title }}</h2>
        <p
          v-for="(paragraph, j) in section.body"
          :key="j"
          class="mb-2 leading-relaxed"
        >
          {{ paragraph }}
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-semibold mb-2">{{ privacyPage.complaintsTitle }}</h2>
        <p class="mb-2 leading-relaxed">
          {{ privacyPage.complaintsBody }}
          <a class="link link-primary" href="https://ico.org.uk/make-a-complaint/" target="_blank" rel="noopener">
            ico.org.uk/make-a-complaint
          </a>
        </p>
      </section>

      <section class="mb-6">
        <h2 class="text-lg font-semibold mb-2">{{ $t('Contact us') }}</h2>
        <a class="link link-primary" :href="`mailto:${SUPPORT_EMAIL}`">{{ SUPPORT_EMAIL }}</a>
      </section>

      <LegalLinks class="mt-8" />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
});

import { SUPPORT_EMAIL, privacyPage } from '@meal-diary/shared';
import LegalLinks from '~/components/LegalLinks.vue';

const goBack = () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigateTo('/login');
  }
};
</script>
