import posthog from 'posthog-js';
import { useAuthStore } from '~/stores/auth';

const POSTHOG_DISABLED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'dev.mealdiary.co.uk',
]);

function isPostHogDisabledForBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    if (POSTHOG_DISABLED_HOSTS.has(host)) return true;
    return host.endsWith('.localhost');
  } catch {
    return false;
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();

  // If localhost or dev.mealdiary.co.uk, skip PostHog
  if (process.client) {
    if (isPostHogDisabledForBaseUrl(config.public.baseUrl as string)) {
      console.log('Skipping PostHog in development');
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
      loaded: (posthog) => {
        if (import.meta.dev) {
          console.log('PostHog loaded');
        }
      },
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

