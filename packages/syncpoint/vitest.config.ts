import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/__tests__/docker/**', 'src/__tests__/e2e/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/__tests__/**', 'src/cli.ts'],
    },
    setupFiles: ['src/__tests__/helpers/setup.ts'],
    globalSetup: 'src/__tests__/helpers/globalSetup.ts',
    testTimeout: 15000,
  },
});
