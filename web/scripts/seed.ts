// Loads fixtures/*.json into the database, then proves the event log replays to the loaded rows.
// events is append-only (trigger in 0001_rules.sql), so the wipe uses TRUNCATE, which the
// trigger does not see. The trigger stays on during the load: events are only inserted.
import { sql } from "drizzle-orm";
import { getClient, getDb } from "../lib/db/client";
import { runMigrations } from "../lib/db/migrate";
import { FIXTURES_DIR, missingFixtures, readAllFixtures } from "../lib/db/fixtures";
import { checkReplay, type EventLike } from "../lib/db/replay";
import * as s from "../lib/db/schema";

type Rows = Record<string, unknown>[];

const camel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// Fixture keys are DDL column names. Drizzle inserts want property names.
function toProps(rows: Rows, drop: string[] = []): Rows {
  return rows.map((r) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => !drop.includes(k)).map(([k, v]) => [camel(k), v])),
  );
}

// Dependency order: parents before children.
const WIPE = "people, teams, team_members, projects, tasks, events, notices, sheet_sources, notes, drafts, email_optins, sends, model_calls";

export async function seed(): Promise<void> {
  const missing = missingFixtures();
  if (missing.length > 0) {
    console.error(`fixtures not ready: missing ${missing.join(", ")} in ${FIXTURES_DIR}`);
    process.exitCode = 1;
    return;
  }
  const f = readAllFixtures();
  await runMigrations();
  const db = getDb();

  await db.transaction(async (tx) => {
    await tx.execute(sql.raw(`TRUNCATE ${WIPE} RESTART IDENTITY CASCADE`));
    await tx.insert(s.people).values(toProps(f.people) as (typeof s.people.$inferInsert)[]);
    await tx.insert(s.teams).values(toProps(f.teams) as (typeof s.teams.$inferInsert)[]);
    await tx.insert(s.teamMembers).values(toProps(f.team_members) as (typeof s.teamMembers.$inferInsert)[]);
    await tx.insert(s.projects).values(toProps(f.projects) as (typeof s.projects.$inferInsert)[]);
    await tx.insert(s.tasks).values(toProps(f.tasks, ["search_tsv"]) as (typeof s.tasks.$inferInsert)[]);
    await tx.insert(s.events).values(toProps(f.events) as (typeof s.events.$inferInsert)[]);
    const notes = toProps(f.notes).map((n) => ({ ...n, synthetic: true }));
    if (notes.length > 0) await tx.insert(s.notes).values(notes as (typeof s.notes.$inferInsert)[]);
  });

  const diffs = checkReplay(f.events as unknown as EventLike[], f.tasks, f.projects);
  if (diffs.length > 0) {
    console.error(`seed refused: the event log does not replay to the loaded rows (${diffs.length} differences)`);
    for (const d of diffs) console.error(`  ${d}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `seed ok: ${f.people.length} people, ${f.teams.length} teams, ${f.projects.length} projects, ` +
      `${f.tasks.length} tasks, ${f.events.length} events, ${f.notes.length} notes (all synthetic)`,
  );
  console.log("OK: replay matches");
}

// Run only when started as `tsx scripts/seed.ts`. The smoke test imports seed() and keeps the client open.
if (process.argv[1] && /scripts[\\/]seed\.ts$/.test(process.argv[1])) {
  seed()
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => getClient().close());
}
