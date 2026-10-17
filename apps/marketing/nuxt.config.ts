// https://nuxt.com/docs/api/configuration/nuxt-config

function getViteAllowedHosts(): string[] {
  const hosts = new Set<string>(['localhost', '127.0.0.1', '.mealdiary.co.uk']);

  if (process.env.SITE_URL) {
    try {
      hosts.add(new URL(process.env.SITE_URL).hostname);
    } catch {
      // ignore invalid SITE_URL
    }
  }

  return [...hosts];
}

const siteUrl = process.env.SITE_URL || 'https://mealdiary.co.uk';
const appUrl = process.env.APP_URL || 'https://app.mealdiary.co.uk';

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  ssr: true,
  devServer: {
    host: '0.0.0.0',
    port: 3010,
  },
  runtimeConfig: {
    public: {
      siteUrl,
      appUrl,
      plansUrl: process.env.PLANS_URL || `${appUrl}/plans`,
      privacyUrl: process.env.PRIVACY_URL || `${appUrl}/privacy`,
      termsUrl: process.env.TERMS_URL || `${appUrl}/terms`,
      posthogPublicKey:
        process.env.POSTHOG_PUBLIC_KEY ||
        'phc_pPO4l7ghvIVDevpRKbW1WOOWQuhvTt4vpn8uV1DFuSN',
      posthogHost: process.env.POSTHOG_HOST || 'https://prxhg.mealdiary.co.uk',
      posthogDefaults: '2025-11-30',
      gaMeasurementId: process.env.GA_MEASUREMENT_ID || '',
    },
  },
  css: ['~/assets/css/main.css'],
  vite: {
    server: {
      allowedHosts: getViteAllowedHosts(),
    },
  },
  modules: ['@nuxt/ui', '@nuxtjs/i18n', '@nuxtjs/sitemap'],
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
    classSuffix: '',
  },
  fonts: {
    families: [
      { name: 'DM Sans', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'Fraunces', provider: 'google', weights: [500, 600, 700] },
    ],
  },
  i18n: {
    locales: [
      {
        code: 'en',
        language: 'en-GB',
        name: 'English',
        file: 'en.json',
      },
    ],
    defaultLocale: 'en',
    lazy: true,
    langDir: 'locales',
    strategy: 'no_prefix',
    detectBrowserLanguage: false,
    bundle: {
      optimizeTranslationDirective: false,
    },
  },
  site: {
    url: siteUrl,
    name: 'Meal Diary',
  },
  sitemap: {
    autoLastmod: true,
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'en-GB',
      },
      link: [
        { rel: 'icon', type: 'image/png', href: '/favicon.png', sizes: '32x32' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png', sizes: '180x180' },
      ],
      meta: [
        { property: 'og:image', content: `${siteUrl}/og-image.png` },
        { name: 'twitter:card', content: 'summary' },
        { name: 'twitter:image', content: `${siteUrl}/og-image.png` },
      ],
    },
  },
});
