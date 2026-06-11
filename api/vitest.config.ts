import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['**/*.{ts,js}'],
      exclude: ['**/__tests__/**', 'node_modules/**', 'coverage/**'],
    },
    projects: [
      {
        // Pure unit tests — DB access is mocked, no Postgres required
        test: {
          name: 'unit',
          include: ['**/*.unit.test.ts'],
          exclude: ['node_modules/**'],
        },
      },
      {
        // Legacy integration tests — require a running Postgres (see globalSetup)
        test: {
          name: 'db',
          include: ['**/*.test.ts'],
          exclude: ['**/*.unit.test.ts', 'node_modules/**'],
          globalSetup: './test/globalSetup.ts',
        },
      },
    ],
  },
});
