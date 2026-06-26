import { defineConfig } from "vitest/config";

// Fast, deterministic unit tests (no DB / no network). Integration tests for the
// durable workflow (which need a throwaway test DB + the @workflow/vitest plugin)
// are intentionally separated as *.integration.test.ts and not run here.
export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "**/*.integration.test.ts"],
  },
});
