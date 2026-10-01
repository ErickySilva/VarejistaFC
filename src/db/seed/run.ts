import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "../../lib/env";
import { seed } from "./seed";

// Uso: npm run db:seed
async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");

  const client = postgres(getEnv().DATABASE_URL, { max: 1 });
  try {
    const result = await seed(drizzle(client));
    console.log("Seed concluído. Linhas inseridas nesta execução:", result);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
