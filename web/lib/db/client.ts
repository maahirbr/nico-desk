import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "./schema";

// NICO_DATA_DIR lets scripts (the smoke test) use their own copy, so a running dev server keeps its data.
export const DATA_DIR = process.env.NICO_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite");

// Singleton on globalThis so dev hot reload does not open the file twice.
const g = globalThis as unknown as {
  __ndPglite?: PGlite;
  __ndDb?: ReturnType<typeof makeDb>;
};

function makeDb(client: PGlite) {
  return drizzle(client, { schema });
}

function open() {
  if (!g.__ndPglite) {
    mkdirSync(DATA_DIR, { recursive: true });
    g.__ndPglite = new PGlite(DATA_DIR);
  }
  if (!g.__ndDb) g.__ndDb = makeDb(g.__ndPglite);
  return { client: g.__ndPglite, db: g.__ndDb };
}

export function getClient() {
  return open().client;
}

export function getDb() {
  return open().db;
}
