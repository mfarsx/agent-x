import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/**/*.test.ts", "apps/**/*.test.tsx", "packages/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      include: [
        "apps/web/app/**/*.{ts,tsx}",
        "apps/web/lib/**/*.ts",
        "apps/worker/src/**/*.ts",
        "packages/core/src/**/*.ts",
        "packages/db/src/**/*.ts",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/index.ts",
        "apps/web/app/layout.tsx",
        "apps/worker/src/index.ts",
        "packages/db/src/client.ts",
      ],
    },
  },
});
