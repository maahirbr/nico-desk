import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import { SCHEMA } from './schema';
import { jobSecret } from './jobs';
import { loadLocalProjects, loadRosterOverlay, seed } from './seed';

// PGlite is Postgres compiled to WASM, running in this process. Locally it stands in for the
// pilot database until an account owner is named (SPEC.md OQ8). Data lives in web/.data/pg.

export type Db = PGlite;
export type Tx = Pick<PGlite, 'query' | 'exec'>;

const parsers = {
  1082: (v: string) => v, // date stays 'YYYY-MM-DD'
  1184: (v: string) => new Date(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString(), // timestamptz
};

export function dataDir(): string {
  return process.env.NICO_DATA_DIR || path.join(process.cwd(), '.data');
}

export function fixturesDir(): string {
  return process.env.NICO_FIXTURES_DIR || path.join(process.cwd(), '..', 'fixtures');
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
}

const g = globalThis as unknown as { __ndDb?: Promise<Db> };

export function db(): Promise<Db> {
  if (!g.__ndDb) {
    const dir = path.join(dataDir(), 'pg');
    fs.mkdirSync(dir, { recursive: true });
    jobSecret(); // make sure the local job secret exists for npm run job:*
    g.__ndDb = openDb(dir, rosterFile());
  }
  return g.__ndDb;
}
