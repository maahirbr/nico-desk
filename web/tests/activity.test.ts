import { beforeAll, describe, expect, it, vi } from 'vitest';

// The activity log (28 Oct): admins only (narrowed by NICO_ACTIVITY_EMAILS), a visit row per person per day from a
// signed-in request, counts by Kolkata day for the last 7 and 30 days, and the table comes to an older database.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { COOKIE, currentMe, resolveMe, signSession, type Me } from '../lib/auth';
import { mayReadActivity, noteVisit, teamActivity } from '../lib/activity';
import { openDb, scoped, upgrade, type Db } from '../lib/db';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

const ADMIN = 'per_fay'; // fixtures: admin only
let db: Db;
let member: string;

beforeAll(async () => {
  process.env.NICO_SESSION_SECRET = 'activity-test-secret';
  db = await openDb();
  state.testDb = db;
  const p = (await s.listPeople(db, TEAM_ID)).find((x) => x.active && x.appRoles.length === 1 && x.appRoles[0] === 'member');
  if (!p) throw new Error('fixture has no plain member');
  member = p.id;
});

const meOf = async (id: string) => (await resolveMe(db, id)) as Me;
const rowOf = async (id: string) => (await teamActivity(scoped(db, TEAM_ID), TEAM_ID)).rows.find((r) => r.id === id)!;

describe('who may read the activity log', () => {
  it('lets an admin in and keeps a member out', async () => {
    expect(mayReadActivity(await meOf(ADMIN))).toBe(true);
    expect(mayReadActivity(await meOf(member))).toBe(false);
  });

  it('narrows to the admins named in NICO_ACTIVITY_EMAILS', async () => {
    const admin = await meOf(ADMIN);
    try {
      process.env.NICO_ACTIVITY_EMAILS = 'someone@example.test';
      expect(mayReadActivity(admin)).toBe(false);
      process.env.NICO_ACTIVITY_EMAILS = ` x@example.test, ${admin.person.email.toUpperCase()} `;
      expect(mayReadActivity(admin)).toBe(true);
    } finally { delete process.env.NICO_ACTIVITY_EMAILS; }
  });
});

describe('visits', () => {
  it('records one day for a signed-in request, and nothing for no session', async () => {
    const days = async () => (await db.query<{ day: string }>(`SELECT day::text FROM visit_days WHERE person_id = $1`, [member])).rows.map((r) => r.day);
    state.jar = {};
    await currentMe();
    expect(await days()).toEqual([]);
    state.jar = { [COOKIE]: signSession(member) };
    await currentMe();
    await currentMe();
    expect(await days()).toEqual(['2026-10-09']);
  });

  it('never throws when the table is missing', async () => {
    const broken = { query: async () => { throw new Error('relation "visit_days" does not exist'); } } as unknown as Db;
    await expect(noteVisit(broken, 'per_nobody')).resolves.toBeUndefined();
  });
});

describe('the counts', () => {
  it('splits the last 7 and 30 Kolkata days, and leaves out removed comments', async () => {
    const before = await rowOf(member);
    const [task] = await s.teamTasks(db, TEAM_ID);
    await db.exec(`
      INSERT INTO comments (id, subject_kind, subject_id, author_id, body, created_at) VALUES
        ('cmt_a1', 'task', '${task.id}', '${member}', 'today', '2026-10-09T10:00:00+05:30'),
        ('cmt_a2', 'task', '${task.id}', '${member}', 'last month', '2026-09-20T10:00:00+05:30'),
        ('cmt_a3', 'task', '${task.id}', '${member}', '', '2026-10-08T10:00:00+05:30');
      UPDATE comments SET deleted_at = now() WHERE id = 'cmt_a3';
      INSERT INTO visit_days VALUES ('${member}', '2026-10-01'), ('${member}', '2026-09-01');`);
    const after = await rowOf(member);
    expect(after.comments.week - before.comments.week).toBe(1);
    expect(after.comments.month - before.comments.month).toBe(2);
    expect(after.days).toEqual({ week: 1, month: 2 }); // 9 Oct and 1 Oct; 1 Sep is past 30 days
    expect(after.lastVisit).toBe('2026-10-09');
    expect(after.lastAction).not.toBeNull();
  });

  it('lists only active people of the team', async () => {
    const { rows } = await teamActivity(scoped(db, TEAM_ID), TEAM_ID);
    const team = (await s.listPeople(db, TEAM_ID)).filter((p) => p.active).map((p) => p.id).sort();
    expect(rows.map((r) => r.id).sort()).toEqual(team);
  });
});

describe('upgrade', () => {
  it('brings visit_days to an older database, with RLS on', async () => {
    await db.exec(`DROP TABLE visit_days;`);
    await upgrade(db);
    const { rows } = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE relname = 'visit_days'`);
    expect(rows[0]?.relrowsecurity).toBe(true);
  });
});
