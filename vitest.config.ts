import { defineConfig } from "vitest/config";

// Minimal Vitest setup for pure public-content helpers only (URL/envelope logic).
// Runtime page verification lives in scripts/smoke-public-content.mjs.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
