import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url));

// Testes que exigem um PostgreSQL real e descartável (TEST_DATABASE_URL).
export default defineConfig({
  resolve: {
    alias: {
      "@": path("./src"),
      "server-only": path("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    // Os testes compartilham um banco e limpam as tabelas entre si.
    fileParallelism: false,
    // Aponta o código da aplicação (getDb, Better Auth) para o banco de teste.
    setupFiles: ["tests/integration/setup-env.ts"],
  },
});
