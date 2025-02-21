// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: false },
  runtimeConfig: {
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_KEY
    }
  },
  css: ['~/assets/css/main.css', '@fortawesome/fontawesome-svg-core/styles.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  modules: ['@vesp/nuxt-fontawesome'],
  fontawesome: {
    component: 'fa',
    icons: {
      solid: ['house', 'list', 'plus', 'circle-user', 'chevron-left', 'chevron-right'],
      brands: [],
      regular: [],
    },
  },
})