import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.unit.test.ts'],
    exclude: ['node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['**/*.unit.test.ts', '**/__tests__/**', 'node_modules/**', 'coverage/**'],
    },
  },
});
