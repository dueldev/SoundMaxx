import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/config";
import * as schema from "@/lib/db/schema";

const globalForDb = globalThis as unknown as {
  sql: postgres.Sql | undefined;
  db: ReturnType<typeof drizzle<typeof schema>> | undefined;
};

export function getDb() {
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!globalForDb.sql) {
    globalForDb.sql = postgres(env.DATABASE_URL, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: "require",
    });
  }

  if (!globalForDb.db) {
    globalForDb.db = drizzle(globalForDb.sql, { schema });
  }

  return globalForDb.db;
}

export async function closeDb() {
  if (globalForDb.sql) {
    await globalForDb.sql.end({ timeout: 2 });
    globalForDb.sql = undefined;
    globalForDb.db = undefined;
  }
}
