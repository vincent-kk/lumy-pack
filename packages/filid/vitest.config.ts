import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    exclude: ['**/fixtures/**'],
    globals: true,
  },
  benchmark: {
    include: ['src/**/__tests__/bench/**/*.bench.ts'],
    exclude: ['**/fixtures/**'],
  },
});
