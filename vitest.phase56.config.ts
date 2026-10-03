import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/soak/phase56TeamIdentityMatrix.test.ts"],
    testTimeout: 600_000,
  },
});
