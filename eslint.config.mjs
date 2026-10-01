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
