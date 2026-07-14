<template>
  <div class="min-h-screen bg-base-100">
    <div class="max-w-2xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">{{ $t('Support') }}</h1>
        <button class="btn btn-ghost btn-sm" data-testid="back-button" @click="goBack">
          {{ $t('Back') }}
        </button>
      </div>

      <p class="mb-6 leading-relaxed">{{ supportPage.intro }}</p>

      <div class="card bg-base-200 mb-8">
        <div class="card-body">
          <h2 class="card-title text-lg">{{ $t('Contact us') }}</h2>
          <p>{{ supportPage.contactBody }}</p>
          <a
            class="link link-primary text-lg"
            :href="`mailto:${SUPPORT_EMAIL}`"
            data-testid="support-email"
          >
            {{ SUPPORT_EMAIL }}
          </a>
        </div>
      </div>

      <h2 class="text-lg font-semibold mb-4">{{ supportPage.faqTitle }}</h2>
      <div
        v-for="(faq, i) in supportPage.faqs"
        :key="i"
        class="collapse collapse-arrow bg-base-200 mb-2"
      >
        <input type="radio" name="support-faq" />
        <div class="collapse-title font-medium">{{ faq.q }}</div>
        <div class="collapse-content">
          <p class="leading-relaxed">{{ faq.a }}</p>
        </div>
      </div>

      <LegalLinks class="mt-8" />
    </div>
  </div>
</template>

<script setup>
definePageMeta({
  layout: false
});

import { SUPPORT_EMAIL, supportPage } from '@meal-diary/shared';
import LegalLinks from '~/components/LegalLinks.vue';

const goBack = () => {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    navigateTo('/login');
  }
};
</script>
