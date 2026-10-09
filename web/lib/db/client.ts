import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// NICO_DATA_DIR lets scripts (the smoke test) use their own copy, so a running dev server keeps its data.
export const DATA_DIR = process.env.NICO_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");

// One type for both drivers. Queries and mutations only use what PgDatabase offers.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type DbClient = { close(): Promise<void> };

// Hosted when DATABASE_URL is set (Supabase through the transaction pooler). Otherwise local PGlite.
export function isHostedDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

// Singleton on globalThis so dev hot reload does not open the file or the pool twice.
const g = globalThis as unknown as { __ndConn?: { db: Db; client: DbClient } };

// Importing a driver does not open anything. PGlite touches the filesystem only in new PGlite(),
// which hosted mode never reaches.
function open(): { db: Db; client: DbClient } {
  if (g.__ndConn) return g.__ndConn;
  const url = process.env.DATABASE_URL;
  if (url) {
    // prepare: false because the Supabase transaction pooler (port 6543) does not keep prepared statements.
    const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20 });
    g.__ndConn = {
      db: drizzlePostgres(sql, { schema }) as unknown as Db,
      client: { close: () => sql.end({ timeout: 5 }) },
    };
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DATABASE_URL is not set. Production needs a Postgres URL because the local PGlite store cannot be written here.");
    }
    mkdirSync(DATA_DIR, { recursive: true });
    const pg = new PGlite(DATA_DIR);
    g.__ndConn = { db: drizzlePglite(pg, { schema }) as unknown as Db, client: { close: () => pg.close() } };
  }
  return g.__ndConn;
}

export function getClient(): DbClient {
  return open().client;
}

export function getDb(): Db {
  return open().db;
}

export type Row = Record<string, unknown>;

// db.execute returns { rows } on PGlite and the row array itself on postgres-js. Read raw SQL through this.
export function rowsOf(res: unknown): Row[] {
  if (Array.isArray(res)) return res as Row[];
  return ((res as { rows?: Row[] } | null)?.rows ?? []) as Row[];
}
