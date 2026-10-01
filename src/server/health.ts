import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export async function isDatabaseUp(): Promise<boolean> {
  try {
    await getDb().execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}
