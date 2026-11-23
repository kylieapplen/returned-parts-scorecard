import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const onVercel = Boolean(process.env.VERCEL);
let pool: pg.Pool | undefined;

type GlobalDb = typeof globalThis & {
  __scorecardPglite?: Promise<PGlite>;
};

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await pool.query(text, params)).rows as T[];
  }
  const g = globalThis as GlobalDb;
  g.__scorecardPglite ??= startLocal().catch((error: unknown) => {
    g.__scorecardPglite = undefined;
    throw error;
  });
  return (await (await g.__scorecardPglite).query<T>(text, params)).rows;
}

async function startLocal(): Promise<PGlite> {
  // Vercel serverless: in-memory PGlite (no persistent disk). For durable
  // storage, set DATABASE_URL (e.g. Vercel Postgres / Neon).
  // Local/dev: file-backed under .data so HMR doesn't wipe records.
  let db: PGlite;
  if (onVercel) {
    db = await PGlite.create();
  } else {
    const dataDir = path.join(process.cwd(), ".data", "pglite");
    await mkdir(dataDir, { recursive: true });
    db = await PGlite.create(dataDir);
  }

  await db.exec(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )
  `);
  const done = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).rows.map(
      (r) => r.name,
    ),
  );
  const migrationsDir = path.join(process.cwd(), "migrations");
  const files = (await readdir(migrationsDir).catch(() => []))
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (done.has(file)) continue;
    const sqlText = await readFile(path.join(migrationsDir, file), "utf8");
    await db.exec(sqlText);
    await db.query("insert into schema_migrations (name) values ($1)", [file]);
  }
  return db;
}
