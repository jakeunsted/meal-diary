// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      baseUrl: process.env.BASE_URL,
      auth0Domain: process.env.AUTH0_DOMAIN,
      auth0ClientId: process.env.AUTH0_CLIENT_ID,
      auth0Audience: process.env.AUTH0_AUDIENCE,
    }
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
      solid: ['house', 'list', 'plus', 'circle-user', 'chevron-left', 'chevron-right', 'chevron-up', 'chevron-down', 'plus', 'xmark', 'pencil'],
      brands: [],
      regular: [],
    },
  },
})