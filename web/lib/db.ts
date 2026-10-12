import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SCHEMA } from './schema';
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
// The hosted database gets the same steps from npm run db:upgrade, which keeps its data.
export async function upgrade(db: Db) {
  // 9 Oct: a block needs a reason; the person is optional (was: person and ask together).
  await db.exec(`DO $$ DECLARE c text; BEGIN
    SELECT conname INTO c FROM pg_constraint WHERE conrelid = 'tasks'::regclass
      AND pg_get_constraintdef(oid) LIKE '%(blocked_on_id IS NULL) = (blocked_ask IS NULL)%';
    IF c IS NOT NULL THEN
      EXECUTE format('ALTER TABLE tasks DROP CONSTRAINT %I', c);
      ALTER TABLE tasks ADD CONSTRAINT tasks_block_person_needs_reason CHECK (blocked_on_id IS NULL OR blocked_ask IS NOT NULL);
    END IF;
  END $$;`);
  // 12 Oct: any written block reason will do (was 10 to 280 characters).
  await db.exec(`DO $$ DECLARE c text; BEGIN
    SELECT conname INTO c FROM pg_constraint WHERE conrelid = 'tasks'::regclass
      AND pg_get_constraintdef(oid) LIKE '%char_length(blocked_ask) >= 10%';
    IF c IS NOT NULL THEN
      EXECUTE format('ALTER TABLE tasks DROP CONSTRAINT %I', c);
      ALTER TABLE tasks ADD CONSTRAINT tasks_blocked_ask_check CHECK (char_length(blocked_ask) BETWEEN 1 AND 280);
    END IF;
  END $$;`);
  // 12 Oct: a task's owner is one of the project's people. Owners of open tasks who are not yet on the project join as Member.
  await db.exec(`INSERT INTO project_members (project_id, person_id, project_role)
    SELECT DISTINCT project_id, owner_id, 'Member' FROM tasks WHERE project_id IS NOT NULL AND status_category = 'open'
    ON CONFLICT (project_id, person_id) DO NOTHING;`);
  // 12 Oct: links on a task. The same statements are in scripts/upgrade-task-links.ts for the hosted database.
  await db.exec(TASK_LINKS_UPGRADE);
  // 12 Oct: archive a project, and tell the previous owner when a task is reassigned. Same statements as scripts/upgrade-project-archive.ts.
  await db.exec(PROJECT_ARCHIVE_UPGRADE);
}

// Idempotent: adds the archive columns and lets a notice be of kind reassigned_away. No new table, so no new RLS step.
export const PROJECT_ARCHIVE_UPGRADE = `
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_at timestamptz;
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_by text REFERENCES people(id);
  DO $$ DECLARE c text; BEGIN
    SELECT conname INTO c FROM pg_constraint WHERE conrelid = 'notices'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%due_tomorrow%' AND pg_get_constraintdef(oid) NOT LIKE '%reassigned_away%';
    IF c IS NOT NULL THEN
      EXECUTE format('ALTER TABLE notices DROP CONSTRAINT %I', c);
      ALTER TABLE notices ADD CONSTRAINT notices_kind_check
        CHECK (kind IN ('due_tomorrow','due_today','overdue','blocked_on_you','assigned','reassigned_away'));
    END IF;
  END $$;`;

// Idempotent: a database made before 12 Oct gets the table; a new one already has it from SCHEMA.
export const TASK_LINKS_UPGRADE = `
  CREATE TABLE IF NOT EXISTS task_links (
    id          text PRIMARY KEY,
    task_id     text NOT NULL REFERENCES tasks(id),
    url         text NOT NULL CHECK (char_length(url) <= 2000),
    label       text CHECK (char_length(label) BETWEEN 1 AND 80),
    created_by  text REFERENCES people(id),
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  CREATE INDEX IF NOT EXISTS task_links_task ON task_links (task_id, created_at);
  -- RLS here too, so npm run db:upgrade cannot leave the new table open to the public anon key.
  ALTER TABLE task_links ENABLE ROW LEVEL SECURITY;`;

const g = globalThis as unknown as { __ndDb?: Promise<Db> };

function openLocal(): Promise<Db> {
  const dir = path.join(dataDir(), 'pg');
  fs.mkdirSync(dir, { recursive: true });
  return openDb(dir, rosterFile());
}

export function db(): Promise<Db> {
  if (!g.__ndDb) {
    jobSecret(); // make sure the local job secret exists for npm run job:*
    // Hosted: the schema and seed come from scripts/db-remote.ts or app/api/cron/reseed (lib/reseed.ts), never from a page load.
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
