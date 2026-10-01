import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

function createDb() {
  const client = postgres(getEnv().DATABASE_URL);
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof createDb>;

// Em desenvolvimento o hot reload reavalia este módulo; guardar a instância em
// globalThis evita abrir um pool de conexões novo a cada recarga.
const globalForDb = globalThis as unknown as { db?: Db };

export function getDb(): Db {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}
