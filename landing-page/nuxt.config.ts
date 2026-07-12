// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  devServer: {
    host: '0.0.0.0',
    port: 3003,
  },
  runtimeConfig: {
    public: {
      appUrl: process.env.APP_URL || '#',
    },
  },
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss() as any],
    server: {
      allowedHosts: true,
    },
  },
})
