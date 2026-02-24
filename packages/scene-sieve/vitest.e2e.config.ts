import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/e2e/**/*.{test,spec}.ts'],
    globalSetup: 'src/__tests__/helpers/globalSetup.ts',
    testTimeout: 120000,
  },
});
