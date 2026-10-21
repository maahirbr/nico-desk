import { beforeAll, describe, expect, it } from 'vitest';
import { openDb, scoped, type Db } from '../lib/db';
import { FENCE } from '../lib/schema';
import { TEAM_ID } from '../lib/seed';
import { teamTasks } from '../lib/service';

// The team fence (lib/schema.ts TEAM_FENCE): scoped work runs as nico_app and sees only its own team's rows.
let db: Db;
const OTHER = 'team_other';

const count = async (d: Db, table: string) => (await d.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;

beforeAll(async () => {
  db = await openDb();
  // A second team with a row in each kind of table, written as the owner.
  await db.exec(`
    INSERT INTO teams VALUES ('${OTHER}', 'Other team', 'run');
    INSERT INTO people (id, display_name, role, department, email) VALUES ('per_out', 'Out Sider', 'x', 'x', 'out@example.test');
    INSERT INTO team_members VALUES ('${OTHER}', 'per_out', 'member');
    INSERT INTO projects (id, team_id, name, department, owner_id, status, status_at) VALUES ('prj_out', '${OTHER}', 'Out project', 'x', 'per_out', 'on_track', now());
    INSERT INTO tasks (id, team_id, title, owner_id, project_id, first_due_on, due_on, health, status, status_category, origin, created_by, created_at)
      VALUES ('tsk_out', '${OTHER}', 'Out task', 'per_out', 'prj_out', '2026-10-20', '2026-10-20', 'on_track', 'Not started', 'open', 'app', 'per_out', now());
    INSERT INTO events (id, entity_type, entity_id, field, after, origin, at) VALUES ('evt_out', 'task', 'tsk_out', '_created', '{}', 'app', now());
    INSERT INTO comments (id, subject_kind, subject_id, author_id, body) VALUES ('cmt_out', 'task', 'tsk_out', 'per_out', 'hi');
    INSERT INTO chat_messages (id, room_kind, room_id, author_id, body) VALUES ('msg_out', 'team', '${OTHER}', 'per_out', 'hi');
    INSERT INTO notices (id, person_id, task_id, kind, for_date, created_at) VALUES ('ntc_out', 'per_out', 'tsk_out', 'assigned', '2026-10-09', now());
    INSERT INTO feedback (id, person_id, body) VALUES ('fb_out', 'per_out', 'note');`);
});

describe('the team fence', () => {
  it('has a policy on every table, so a new table cannot be left open', async () => {
    const { rows } = await db.query<{ tablename: string }>(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1`);
    const { rows: fenced } = await db.query<{ tablename: string }>(`SELECT tablename FROM pg_policies WHERE policyname = 'team_fence' ORDER BY 1`);
    expect(fenced.map((r) => r.tablename)).toEqual(rows.map((r) => r.tablename));
    expect(Object.keys(FENCE).sort()).toEqual(rows.map((r) => r.tablename));
  });

  it('shows nothing when no team is set', async () => {
    for (const t of Object.keys(FENCE)) {
      const n = await db.transaction(async (tx) => {
        await tx.query(`SELECT set_config('role', 'nico_app', true)`);
        return (await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${t}`)).rows[0].n;
      });
      expect(n, t).toBe(0);
    }
  });

  it("keeps each team's rows from the other", async () => {
    const pilot = scoped(db, TEAM_ID);
    const other = scoped(db, OTHER);
    for (const t of ['teams', 'people', 'projects', 'tasks', 'events', 'comments', 'chat_messages', 'notices', 'feedback']) {
      const all = await count(db, t);
      const [a, b] = [await count(pilot, t), await count(other, t)];
      expect(b, t).toBe(1);
      expect(a + b, t).toBe(all);
    }
    expect((await teamTasks(pilot, OTHER)).length).toBe(0); // a wrong team id in the query finds nothing
    expect((await teamTasks(other, OTHER)).map((x) => x.id)).toEqual(['tsk_out']);
  });

  it("refuses a write into another team's rows", async () => {
    const pilot = scoped(db, TEAM_ID);
    await expect(pilot.query(`INSERT INTO projects (id, team_id, name, department, owner_id, status, status_at) VALUES ('prj_x', '${OTHER}', 'X', 'x', 'per_out', 'on_track', now())`))
      .rejects.toThrow(/row-level security/);
    const { affectedRows } = await pilot.query(`UPDATE tasks SET title = 'taken' WHERE id = 'tsk_out'`);
    expect(affectedRows).toBe(0);
    expect((await db.query(`SELECT title FROM tasks WHERE id = 'tsk_out'`)).rows[0].title).toBe('Out task');
  });

  it('hands the connection back as the owner', async () => {
    await scoped(db, TEAM_ID).query(`SELECT 1`);
    const { rows } = await db.query<{ u: string; t: string | null }>(`SELECT current_user AS u, current_setting('app.team_id', true) AS t`);
    expect(rows[0].u).toBe('postgres');
    expect(rows[0].t || null).toBeNull();
  });
});
