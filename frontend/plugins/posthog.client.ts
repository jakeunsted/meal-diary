import posthog from 'posthog-js';
import { useAuthStore } from '~/stores/auth';

const POSTHOG_DISABLED_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'dev.mealdiary.co.uk',
]);

function isPostHogDisabledHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (POSTHOG_DISABLED_HOSTS.has(host)) return true;
  return host.endsWith('.localhost');
}

function shouldDisablePostHog(config: ReturnType<typeof useRuntimeConfig>): boolean {
  if (import.meta.dev) {
    return true;
  }

  const hostnames: string[] = [];

  if (process.client && typeof window !== 'undefined') {
    hostnames.push(window.location.hostname);
  }

  const origin = config.public.origin as string | undefined;
  if (origin) {
    try {
      hostnames.push(new URL(origin).hostname);
    } catch {
      /* ignore invalid ORIGIN */
    }
  }

  const baseUrl = config.public.baseUrl as string | undefined;
  if (baseUrl) {
    try {
      hostnames.push(new URL(baseUrl).hostname);
    } catch {
      /* ignore invalid BASE_URL */
    }
  }

  return hostnames.some((hostname) => isPostHogDisabledHost(hostname));
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig();

  const noopPostHog = {
    capture: () => {},
    identify: () => {},
    reset: () => {},
  };

  if (process.client && shouldDisablePostHog(config)) {
    if (import.meta.dev) {
      console.log('Skipping PostHog in development');
    }
    nuxtApp.provide('posthog', noopPostHog);
    return;
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

