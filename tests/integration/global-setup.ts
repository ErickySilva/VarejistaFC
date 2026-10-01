import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { getTestDatabaseUrl } from "./test-database";

// Aplica as migrations do repositório no banco de teste, pelo mesmo migrador
// usado em produção.
export default async function setup() {
  const client = postgres(getTestDatabaseUrl(), { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder: "src/db/migrations" });
  } finally {
    await client.end();
  }
}
