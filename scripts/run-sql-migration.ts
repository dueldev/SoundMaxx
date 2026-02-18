import { readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run migrations");
}

const sql = postgres(databaseUrl, {
  ssl: "require",
  max: 1,
  prepare: false,
});

async function run() {
  const filePath = path.resolve(process.cwd(), "drizzle/0000_initial.sql");
  const migration = readFileSync(filePath, "utf8");

  await sql.unsafe(migration);
  await sql.end({ timeout: 2 });

  console.log("Applied migration:", filePath);
}

run().catch(async (error) => {
  console.error(error);
  await sql.end({ timeout: 1 }).catch(() => undefined);
  process.exit(1);
});
