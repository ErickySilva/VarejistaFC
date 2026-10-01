import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Testes que exigem um PostgreSQL real e descartável (TEST_DATABASE_URL).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    // Os testes compartilham um banco e limpam as tabelas entre si.
    fileParallelism: false,
  },
});
