import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    include: ['**/*.unit.test.ts'],
    exclude: ['node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: ['**/*.{ts,tsx}'],
      exclude: [
        '**/*.unit.test.ts',
        '**/__tests__/**',
        'node_modules/**',
        'coverage/**',
        'android/**',
        'ios/**',
      ],
    },
  },
  define: {
    __DEV__: 'true',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
