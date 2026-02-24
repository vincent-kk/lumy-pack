import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.{test,spec}.ts'],
    exclude: ['src/__tests__/e2e/**'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/cli.ts', 'src/version.ts'],
    },
    setupFiles: ['src/__tests__/helpers/setup.ts'],
    testTimeout: 30000,
  },
});
