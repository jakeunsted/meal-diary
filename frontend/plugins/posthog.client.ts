import posthog from 'posthog-js';
import { useAuthStore } from '~/stores/auth';

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();

  // If localhost or dev.mealdiary.co.uk, skip PostHog
  if (process.client) {
    if (config.public.baseUrl.includes('localhost') || config.public.baseUrl.includes('dev.mealdiary.co.uk')) {
      nuxtApp.provide('posthog', {
        capture: () => {},
        identify: () => {},
        reset: () => {},
      });
      return;
    }
  }
  
  if (process.client && config.public.posthogPublicKey) {
    posthog.init(config.public.posthogPublicKey as string, {
      api_host: config.public.posthogHost as string || 'https://eu.i.posthog.com',
      capture_pageview: false, // We'll handle this manually
      capture_pageleave: true,
    });

    // Identify user when they log in
    const authStore = useAuthStore();
    if (authStore.user) {
      posthog.identify(authStore.user.id.toString(), {
        email: authStore.user.email,
        name: `${authStore.user.first_name} ${authStore.user.last_name}`,
      });
    }

    // Make PostHog available globally
    nuxtApp.provide('posthog', posthog);
  }
});

