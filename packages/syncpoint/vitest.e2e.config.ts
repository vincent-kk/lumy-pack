import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/e2e/**/*.{test,spec}.{ts,tsx}", "src/__tests__/docker/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 30000,
  },
});
