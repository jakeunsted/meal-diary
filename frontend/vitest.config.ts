import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.unit.test.ts'],
    exclude: ['node_modules/**', 'cypress/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      all: true,
      include: [
        'utils/**/*.ts',
        'stores/**/*.ts',
        'composables/**/*.ts',
        'plugins/**/*.ts',
      ],
      exclude: ['cypress/**', '**/*.unit.test.ts', '**/__tests__/**', 'node_modules/**', 'coverage/**'],
    },
  },
  define: {
    'import.meta.client': 'globalThis.__NUXT_CLIENT__',
    'import.meta.dev': 'globalThis.__NUXT_DEV__',
    'import.meta.server': 'globalThis.__NUXT_SERVER__',
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname),
      '#app': path.resolve(__dirname, 'vitest-nuxt-app.ts'),
    },
  },
});
