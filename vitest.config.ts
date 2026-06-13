import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    globals: true,
    projects: [
      {
        // Pure unit tests: no DB, no external IO, no env required.
        resolve: { alias },
        test: {
          name: "unit",
          globals: true,
          environment: "node",
          include: ["tests/unit/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      {
        // Integration tests: hit the docker-compose Postgres; load .env first.
        resolve: { alias },
        test: {
          name: "integration",
          globals: true,
          environment: "node",
          include: ["tests/integration/**/*.{test,spec}.{ts,tsx}"],
          setupFiles: ["./tests/setup.integration.ts"],
          // Wipes the test DB after the whole suite — a crashed test that skips
          // its afterEach can never poison the next run.
          globalSetup: ["./tests/teardown.integration.ts"],
        },
      },
    ],
  },
});
