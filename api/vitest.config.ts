import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: './test/globalSetup.ts',
    coverage: {
      provider: 'v8',
      include: ['**/*.{ts,js}'],
      exclude: ['**/__tests__/**', 'node_modules/**', 'coverage/**'],
    },
  },
});
