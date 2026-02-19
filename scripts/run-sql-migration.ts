import { readdirSync, readFileSync } from "node:fs";
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
  const migrationsDir = path.resolve(process.cwd(), "drizzle");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const filename of migrationFiles) {
    const filePath = path.join(migrationsDir, filename);
    const migration = readFileSync(filePath, "utf8");

    await sql.unsafe(migration);
    console.log("Applied migration:", filePath);
  }

  await sql.end({ timeout: 2 });
}

run().catch(async (error) => {
  console.error(error);
  await sql.end({ timeout: 1 }).catch(() => undefined);
  process.exit(1);
});
