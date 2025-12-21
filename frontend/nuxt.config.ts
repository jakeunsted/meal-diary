// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      baseUrl: process.env.BASE_URL,
      origin: process.env.ORIGIN,
    }
  },
  app: {
    // head: {
    //   viewport: 'width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover, height=device-height',
    //   meta: [
    //     { name: 'viewport', content: 'width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover, height=device-height' }
    //   ]
    // }
  },
  css: [
    '~/assets/css/main.css',
    '~/assets/css/main.scss',
    '@fortawesome/fontawesome-svg-core/styles.css',
  ],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  modules: [
    '@vesp/nuxt-fontawesome',
    '@pinia/nuxt',
    '@formkit/auto-animate/nuxt',
    '@nuxtjs/i18n',
  ],
  fontawesome: {
    component: 'fa',
    icons: {
      solid: [
        'house', 
        'list', 
        'plus', 
        'circle-user',
        'chevron-left',
        'chevron-right',
        'chevron-up',
        'chevron-down',
        'plus',
        'xmark',
        'pencil',
        'grip',
        'grip-vertical',
        'copy',
        'pen',
      ],
      brands: [],
      regular: [],
    },
  },
  i18n: {
    locales: [
      { code: 'en', iso: 'en-US', name: 'English', file: 'en.json' },
    ],
    defaultLocale: "en",
    strategy: "prefix_except_default",
    langDir: 'locales/',
    lazy: true,
    vueI18n: './i18n/i18n.config.ts'
  },
})