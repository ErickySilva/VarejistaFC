import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getEnv } from "@/lib/env";
import * as schema from "./schema";

function createDb() {
  const client = postgres(getEnv().DATABASE_URL);
  return drizzle(client, { schema });
}

type RootDb = ReturnType<typeof createDb>;

export type Transaction = Parameters<Parameters<RootDb["transaction"]>[0]>[0];

// Conexão ou transação: tudo o que faz consultas aceita qualquer uma das duas.
export type Db = RootDb | Transaction;

// Em desenvolvimento o hot reload reavalia este módulo; guardar a instância em
// globalThis evita abrir um pool de conexões novo a cada recarga.
const globalForDb = globalThis as unknown as {
  db?: RootDb;
  transactionStorage?: AsyncLocalStorage<Transaction>;
};

function rootDb(): RootDb {
  globalForDb.db ??= createDb();
  return globalForDb.db;
}

const transactionStorage = (globalForDb.transactionStorage ??=
  new AsyncLocalStorage<Transaction>());

export function currentTransaction(): Transaction | undefined {
  return transactionStorage.getStore();
}

// Devolve a transação em andamento neste fluxo assíncrono, se houver; senão,
// a conexão normal.
export function getDb(): Db {
  return currentTransaction() ?? rootDb();
}

// Executa `fn` dentro de uma transação. Tudo o que usar `getDb()` ou
// `contextDb` durante `fn`, inclusive o Better Auth, participa dela: ou tudo
// é gravado, ou nada é. Chamadas aninhadas reutilizam a transação externa.
export function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  if (currentTransaction()) return fn();
  return rootDb().transaction((tx) => transactionStorage.run(tx, fn));
}

// Objeto de banco "sensível a contexto": cada acesso é encaminhado para a
// transação em andamento ou, fora de uma, para a conexão normal. É o banco
// entregue ao adaptador do Better Auth, para que as operações dele entrem nas
// nossas transações (ADR 0011).
export const contextDb = new Proxy({} as RootDb, {
  get(_target, property) {
    const db = getDb();
    const value = Reflect.get(db, property, db);
    return typeof value === "function" ? value.bind(db) : value;
  },
  has(_target, property) {
    return Reflect.has(getDb(), property);
  },
});
