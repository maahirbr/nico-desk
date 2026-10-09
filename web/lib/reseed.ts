import fs from 'node:fs';
import path from 'node:path';
import { fixturesDir, type Tx } from './db';
import { SCHEMA } from './schema';
import { seed } from './seed';
import { shiftDays, shiftJson } from './shift';

// Hosted demo upkeep: the seeded dates go stale once a week passes (lib/shift.ts moves them by whole
// weeks at seed time), so a weekly cron wipes and reseeds. scripts/db-remote.ts uses the same body.

const read = (dir: string, name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));

// True when the stored data was seeded for another week. The marker is the first fixture task's
// first_due_on: it is locked by a trigger (lib/schema.ts), so visitor edits never change it.
export async function reseedDue(tx: Tx, dir: string = fixturesDir()): Promise<boolean> {
  const id: string = read(dir, 'tasks.json')[0].id;
  const created = read(dir, 'events.json').find((e: any) => e.entity_id === id && e.field === '_created');
  const want = shiftJson<string>(created.after.due_on, shiftDays());
  const { rows } = await tx.query<{ d: string }>(`SELECT first_due_on::text AS d FROM tasks WHERE id = $1`, [id]);
  return rows[0]?.d !== want;
}

// Only what SCHEMA itself creates is dropped, so other tables in the database stay.
export const schemaTables = () => [...SCHEMA.matchAll(/^CREATE TABLE (\w+)/gm)].map((m) => m[1]);

// Drops the app tables, recreates them and loads the fixtures. Returns the number of tables with RLS on.
export async function reseed(tx: Tx, dir: string = fixturesDir()): Promise<number> {
  const functions = [...SCHEMA.matchAll(/^CREATE FUNCTION (\w+)/gm)].map((m) => m[1]);
  await tx.exec(`DROP TABLE IF EXISTS ${schemaTables().join(', ')} CASCADE`);
  for (const f of functions) await tx.exec(`DROP FUNCTION IF EXISTS ${f}() CASCADE`);
  await tx.exec(SCHEMA);
  await seed(tx, dir);
  // The app connects as the table owner, which RLS does not bind. With no policies, the public anon key reads nothing.
  const { rows } = await tx.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public'`);
  for (const { tablename } of rows) await tx.exec(`ALTER TABLE public."${tablename}" ENABLE ROW LEVEL SECURITY`);
  return rows.length;
}
