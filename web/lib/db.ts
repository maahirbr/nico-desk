import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PUBLIC_API_LOCK, SCHEMA, TEAM_FENCE } from './schema';
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
  // 13 Oct: "seen" for Updates lives on the person's account, not in a browser cookie.
  await db.exec(UPDATE_SEEN_UPGRADE);
  // 13 Oct: a project can have a lead who is not its owner.
  await db.exec(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS lead_id text REFERENCES people(id);`);
  // 13 Oct: one person can sign in from more than one address (a company and a partner address).
  await db.exec(`ALTER TABLE people ADD COLUMN IF NOT EXISTS alt_emails text[] NOT NULL DEFAULT '{}';`);
  // 13 Oct: a profile photo (Google's, or one uploaded) and an optional phone.
  await db.exec(PEOPLE_PROFILE_UPGRADE);
  // 13 Oct: project visibility. A restricted person sees only their projects and the ones they were given view on.
  await db.exec(VISIBILITY_UPGRADE);
  // 13 Oct: comments with @ and #, and a notice kind for a mention.
  await db.exec(COMMENTS_UPGRADE);
  // 13 Oct: pilot feedback from inside the app.
  await db.exec(FEEDBACK_UPGRADE);
  // 14 Oct: screenshots on a feedback note, and "+1".
  await db.exec(FEEDBACK_EXTRAS_UPGRADE);
  // 13 Oct: a meeting rhythm on a project. Same statements as scripts/upgrade-meetings.ts for the hosted database.
  await db.exec(MEETINGS_UPGRADE);
  // 13 Oct: a lead's Google Meet link (encrypted refresh token).
  await db.exec(GOOGLE_LINKS_UPGRADE);
  // 13 Oct: team chat, with a message_id on notices for a mention in chat.
  await db.exec(CHAT_UPGRADE);
  // 19 Oct: a reminder keeps which items it held, so the next draft can leave out what was just sent.
  await db.exec(`ALTER TABLE reminders ADD COLUMN IF NOT EXISTS item_keys text[];`);
  // 19 Oct: the public API roles get no rights and a deny policy on every table. Last, so it covers new tables.
  await db.exec(PUBLIC_API_LOCK);
  // 21 Oct: the team fence (nico_app and one policy per table). Last too, so it covers new tables.
  await db.exec(TEAM_FENCE);
}

// Idempotent: the chat tables (RLS on, no policies) and message_id on notices. The same SQL as lib/schema.ts.
export const CHAT_UPGRADE = `
  CREATE TABLE IF NOT EXISTS chat_messages (
    id          text PRIMARY KEY,
    room_kind   text NOT NULL CHECK (room_kind IN ('team','project')),
    room_id     text NOT NULL,
    author_id   text NOT NULL REFERENCES people(id),
    body        text NOT NULL CHECK (char_length(body) <= 4000),
    created_at  timestamptz NOT NULL DEFAULT now(),
    edited_at   timestamptz,
    deleted_at  timestamptz
  );
  CREATE INDEX IF NOT EXISTS chat_messages_room ON chat_messages (room_kind, room_id, created_at, id);
  ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
  CREATE TABLE IF NOT EXISTS chat_refs (
    message_id  text NOT NULL REFERENCES chat_messages(id),
    ref_kind    text NOT NULL CHECK (ref_kind IN ('person','task','project')),
    ref_id      text NOT NULL,
    PRIMARY KEY (message_id, ref_kind, ref_id)
  );
  ALTER TABLE chat_refs ENABLE ROW LEVEL SECURITY;
  CREATE TABLE IF NOT EXISTS chat_reads (
    person_id    text NOT NULL REFERENCES people(id),
    room_kind    text NOT NULL CHECK (room_kind IN ('team','project')),
    room_id      text NOT NULL,
    read_at      timestamptz NOT NULL,
    PRIMARY KEY (person_id, room_kind, room_id)
  );
  ALTER TABLE chat_reads ENABLE ROW LEVEL SECURITY;
  CREATE TABLE IF NOT EXISTS chat_task_links (
    message_id  text NOT NULL REFERENCES chat_messages(id),
    task_id     text NOT NULL REFERENCES tasks(id),
    made_by     text NOT NULL REFERENCES people(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (message_id, task_id)
  );
  CREATE INDEX IF NOT EXISTS chat_task_links_task ON chat_task_links (task_id);
  ALTER TABLE chat_task_links ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notices ADD COLUMN IF NOT EXISTS message_id text REFERENCES chat_messages(id);`;

// Idempotent: screenshots on a note, "+1", replies, and who may reply (RLS on, no policies). The same SQL as lib/schema.ts.
export const FEEDBACK_EXTRAS_UPGRADE = `
CREATE TABLE IF NOT EXISTS feedback_images (
  feedback_id text NOT NULL REFERENCES feedback(id),
  n           smallint NOT NULL CHECK (n BETWEEN 1 AND 3),
  bytes       bytea NOT NULL,
  mime        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, n)
);
ALTER TABLE feedback_images ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS feedback_votes (
  feedback_id text NOT NULL REFERENCES feedback(id),
  person_id   text NOT NULL REFERENCES people(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (feedback_id, person_id)
);
ALTER TABLE feedback_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ADD COLUMN IF NOT EXISTS replies_feedback boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS feedback_replies (
  id          text PRIMARY KEY,
  feedback_id text NOT NULL REFERENCES feedback(id),
  author_id   text NOT NULL REFERENCES people(id),
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  seen_at     timestamptz                     -- when the note's writer saw it on Home or the Feedback page
);
CREATE INDEX IF NOT EXISTS feedback_replies_note ON feedback_replies (feedback_id, created_at);
ALTER TABLE feedback_replies ENABLE ROW LEVEL SECURITY;`;

// Idempotent: the feedback table (RLS on, no policies, like every other table). The same SQL as lib/schema.ts.
export const FEEDBACK_UPGRADE = `
  CREATE TABLE IF NOT EXISTS feedback (
    id          text PRIMARY KEY,
    person_id   text NOT NULL REFERENCES people(id),
    path        text,
    body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
    created_at  timestamptz NOT NULL DEFAULT now(),
    read_at     timestamptz
  );
  CREATE INDEX IF NOT EXISTS feedback_created ON feedback (created_at DESC);
  ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;`;

// Idempotent: four columns on projects for the meeting rhythm. No new table, so no new RLS step.
export const MEETINGS_UPGRADE = `
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS meet_every text CHECK (meet_every IN ('weekly','fortnightly','monthly','as_needed'));
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS meet_day smallint CHECK (meet_day BETWEEN 1 AND 7);
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS meet_next date;
  ALTER TABLE projects ADD COLUMN IF NOT EXISTS meet_last date;`;

// Idempotent: the google_links table, RLS on with no policies.
export const GOOGLE_LINKS_UPGRADE = `
  CREATE TABLE IF NOT EXISTS google_links (
    person_id    text PRIMARY KEY REFERENCES people(id),
    email        text NOT NULL,
    scopes       text[] NOT NULL DEFAULT '{}',
    refresh_enc  text NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
  );
  ALTER TABLE google_links ENABLE ROW LEVEL SECURITY;`;

// Idempotent: the two comment tables (RLS on, no policies) and a notices table that can hold a mention (no task, a comment).
export const COMMENTS_UPGRADE = `
  CREATE TABLE IF NOT EXISTS comments (
    id            text PRIMARY KEY,
    subject_kind  text NOT NULL CHECK (subject_kind IN ('task','project')),
    subject_id    text NOT NULL,
    author_id     text NOT NULL REFERENCES people(id),
    body          text NOT NULL CHECK (char_length(body) <= 2000),
    created_at    timestamptz NOT NULL DEFAULT now(),
    edited_at     timestamptz,
    deleted_at    timestamptz
  );
  CREATE INDEX IF NOT EXISTS comments_subject ON comments (subject_kind, subject_id, created_at);
  ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
  CREATE TABLE IF NOT EXISTS comment_refs (
    comment_id  text NOT NULL REFERENCES comments(id),
    ref_kind    text NOT NULL CHECK (ref_kind IN ('person','task','project')),
    ref_id      text NOT NULL,
    PRIMARY KEY (comment_id, ref_kind, ref_id)
  );
  ALTER TABLE comment_refs ENABLE ROW LEVEL SECURITY;
  ALTER TABLE notices ALTER COLUMN task_id DROP NOT NULL;
  ALTER TABLE notices ADD COLUMN IF NOT EXISTS comment_id text REFERENCES comments(id);
  DO $$ DECLARE c text; BEGIN
    SELECT conname INTO c FROM pg_constraint WHERE conrelid = 'notices'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%due_tomorrow%' AND pg_get_constraintdef(oid) NOT LIKE '%mentioned%';
    IF c IS NOT NULL THEN
      EXECUTE format('ALTER TABLE notices DROP CONSTRAINT %I', c);
      ALTER TABLE notices ADD CONSTRAINT notices_kind_check
        CHECK (kind IN ('due_tomorrow','due_today','overdue','blocked_on_you','assigned','reassigned_away','mentioned'));
    END IF;
  END $$;`;

// Idempotent: the restricted flag and the viewers table. RLS on with no policies, like every other table.
export const VISIBILITY_UPGRADE = `
  ALTER TABLE people ADD COLUMN IF NOT EXISTS restricted boolean NOT NULL DEFAULT false;
  CREATE TABLE IF NOT EXISTS project_viewers (
    project_id  text NOT NULL REFERENCES projects(id),
    person_id   text NOT NULL REFERENCES people(id),
    added_by    text REFERENCES people(id),
    added_at    timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, person_id)
  );
  ALTER TABLE project_viewers ENABLE ROW LEVEL SECURITY;`;

// Idempotent: adds the profile columns and the photo table. RLS on with no policies, like every other table.
export const PEOPLE_PROFILE_UPGRADE = `
  ALTER TABLE people ADD COLUMN IF NOT EXISTS photo_url text;
  ALTER TABLE people ADD COLUMN IF NOT EXISTS phone text CHECK (phone ~ '^[0-9 +-]{7,20}$');
  CREATE TABLE IF NOT EXISTS person_photos (
    person_id   text PRIMARY KEY REFERENCES people(id),
    bytes       bytea NOT NULL,
    mime        text NOT NULL CHECK (mime IN ('image/webp','image/jpeg','image/png')),
    updated_at  timestamptz NOT NULL DEFAULT now()
  );
  ALTER TABLE person_photos ENABLE ROW LEVEL SECURITY;`;

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
// Idempotent: a database made before 13 Oct gets the table. RLS on with no policies, like every other table.
export const UPDATE_SEEN_UPGRADE = `
  CREATE TABLE IF NOT EXISTS update_seen (
    person_id  text NOT NULL REFERENCES people(id),
    scope      text NOT NULL,
    seen_at    timestamptz NOT NULL,
    PRIMARY KEY (person_id, scope)
  );
  ALTER TABLE update_seen ENABLE ROW LEVEL SECURITY;`;

// One team's view of the database. Every call runs in a transaction that first sets the team and drops to nico_app,
// which RLS binds (TEAM_FENCE in lib/schema.ts). Both settings are local, so they end with the transaction and the
// pooler hands back a clean session. Signed-in work uses this; sign-in and the cron use db() as the owner.
const FENCE_ON = `SELECT set_config('app.team_id', $1, true), set_config('role', 'nico_app', true)`;

export function scoped(d: Db, teamId: string): Db {
  const transaction = <T>(fn: (tx: Tx) => Promise<T>) => d.transaction(async (tx) => {
    await tx.query(FENCE_ON, [teamId]);
    return fn(tx);
  });
  return {
    query: (sql, params) => transaction((tx) => tx.query(sql, params)),
    exec: (sql) => transaction((tx) => tx.exec(sql)),
    transaction,
  };
}

const g = globalThis as unknown as { __ndDb?: Promise<Db> };

function openLocal(): Promise<Db> {
  const dir = path.join(dataDir(), 'pg');
  fs.mkdirSync(dir, { recursive: true });
  return openDb(dir, rosterFile());
}

export function db(): Promise<Db> {
  if (!g.__ndDb) {
    if (!process.env.VERCEL) jobSecret(); // make sure the local job secret exists for npm run job:*
    // Hosted: the schema and seed come from scripts/db-remote.ts (lib/reseed.ts), never from a page load.
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
