import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FIRST_DUE_FN, SCHEMA } from './schema';
import { jobSecret } from './jobs';
import { loadLocalProjects, loadRosterOverlay, seed } from './seed';

// PGlite is Postgres compiled to WASM, running in this process. Locally it stands in for the
// pilot database until an account owner is named (SPEC.md OQ8). Data lives in web/.data/pg.
// With DATABASE_URL set, the same interface runs over postgres-js (lib/pgRemote.ts) instead.
// On Vercel with no DATABASE_URL, PGlite lives in the temp dir and reseeds per instance.

export type Tx = {
  query<T = any>(sql: string, params?: any[]): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(sql: string): Promise<unknown>;
};
export type Db = Tx & { transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> };

export const parsers = {
  1082: (v: string) => v, // date stays 'YYYY-MM-DD'
  1184: (v: string) => new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString(), // timestamptz
};

// Vercel's disk is read-only except the temp dir.
export function dataDir(): string {
  return process.env.NICO_DATA_DIR || (process.env.VERCEL ? path.join(os.tmpdir(), 'nico-desk') : path.join(process.cwd(), '.data'));
}

// ../fixtures is traced into the Vercel functions by next.config.ts; ./fixtures covers a flatter layout.
export function fixturesDir(): string {
  if (process.env.NICO_FIXTURES_DIR) return process.env.NICO_FIXTURES_DIR;
  const up = path.join(process.cwd(), '..', 'fixtures');
  return fs.existsSync(up) ? up : path.join(process.cwd(), 'fixtures');
}

// roster.local.json (git-ignored) puts real names on a local run; fixtures stay synthetic.
export function rosterFile(): string {
  return process.env.NICO_ROSTER || path.join(process.cwd(), 'roster.local.json');
}

export async function openDb(dir?: string, roster?: string): Promise<Db> {
  const db = new PGlite(dir ? { dataDir: dir, parsers } : { parsers });
  await db.waitReady;
  await db.exec(`SET TIME ZONE 'UTC'`);
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = 'tasks'`,
  );
  if (rows[0].n === 0) {
    await db.exec(SCHEMA);
    const local = roster ? loadLocalProjects(path.join(path.dirname(roster), 'projects.local.json')) : undefined;
    await seed(db, fixturesDir(), roster ? loadRosterOverlay(roster) : undefined, local);
  }
  await upgrade(db);
  return db;
}

// In-place changes for a database made by an older schema, so local data survives. Each step is idempotent.
async function upgrade(db: Db) {
  // 9 Oct: a block needs a reason; the person is optional (was: person and ask together).
  await db.exec(`DO $$ DECLARE c text; BEGIN
    SELECT conname INTO c FROM pg_constraint WHERE conrelid = 'tasks'::regclass
      AND pg_get_constraintdef(oid) LIKE '%(blocked_on_id IS NULL) = (blocked_ask IS NULL)%';
    IF c IS NOT NULL THEN
      EXECUTE format('ALTER TABLE tasks DROP CONSTRAINT %I', c);
      ALTER TABLE tasks ADD CONSTRAINT tasks_block_person_needs_reason CHECK (blocked_on_id IS NULL OR blocked_ask IS NOT NULL);
    END IF;
  END $$;`);
  // v2: asks. Additive columns, and the first-date trigger lets a pending ask set its date once.
  await db.exec(`ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS ask_state text CHECK (ask_state IN ('asked','accepted','countered','declined','cant')),
    ADD COLUMN IF NOT EXISTS ask_due_on date,
    ADD COLUMN IF NOT EXISTS ask_counter_on date,
    ADD COLUMN IF NOT EXISTS ask_reason text CHECK (char_length(ask_reason) <= 280)`);
  await db.exec(FIRST_DUE_FN);
  await db.exec(`CREATE INDEX IF NOT EXISTS tasks_asks ON tasks (team_id, ask_state) WHERE ask_state IS NOT NULL`);
}

const g = globalThis as unknown as { __ndDb?: Promise<Db> };

function openLocal(): Promise<Db> {
  const dir = path.join(dataDir(), 'pg');
  fs.mkdirSync(dir, { recursive: true });
  return openDb(dir, rosterFile());
}

export function db(): Promise<Db> {
  if (!g.__ndDb) {
    jobSecret(); // make sure the local job secret exists for npm run job:*
    // Hosted: the schema and seed come from scripts/db-remote.ts, never from a page load.
    const url = process.env.DATABASE_URL;
    const opening = url ? import('./pgRemote').then((m) => m.openRemote(url)) : openLocal();
    // A failed open must not stick for the life of a warm serverless instance.
    g.__ndDb = opening.catch((e) => {
      g.__ndDb = undefined;
      throw e;
    });
  }
  return g.__ndDb;
}
