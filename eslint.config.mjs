import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // O domínio é puro: sem banco, sem servidor e sem framework (ADR 0001).
    files: ["src/domain/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/db",
                "@/db/**",
                "@/server",
                "@/server/**",
                "@/app/**",
                "**/db/**",
                "**/server/**",
                "next",
                "next/**",
                "react",
                "react-dom",
                "drizzle-orm",
                "drizzle-orm/**",
                "postgres",
              ],
              message:
                "src/domain não pode depender de banco, servidor ou framework.",
            },
          ],
        },
      ],
    },
  },
  {
    // Páginas e componentes só falam com o banco e com a autenticação através
    // de src/server, onde a autorização é conferida (ADR 0011).
    files: ["src/app/**", "src/components/**"],
    ignores: ["src/app/api/auth/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/db",
                "@/db/**",
                "drizzle-orm",
                "drizzle-orm/**",
                "postgres",
                "better-auth",
                "better-auth/**",
              ],
              message:
                "Use as funções de src/server em vez de acessar o banco ou o Better Auth diretamente.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/db/migrations/**",
  ]),
]);

export default eslintConfig;
