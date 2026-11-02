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
import { mayReadActivity, noteVisit, statusOf, teamAdoption } from '../lib/activity';
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
const rowOf = async (id: string) => (await teamAdoption(scoped(db, TEAM_ID), TEAM_ID)).find((r) => r.id === id)!;

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

describe('who is using the app', () => {
  it('reads Daily from all 5 weekdays before today, Some days from any day this week, Gone quiet from an older trace, else Never', () => {
    expect([statusOf(5, 5, true), statusOf(4, 6, true), statusOf(0, 1, false), statusOf(0, 0, true), statusOf(0, 0, false)]).toEqual(['daily', 'some', 'some', 'quiet', 'never']);
  });

  it('moves a new person from Never to Gone quiet, This week and Daily as their traces come in', async () => {
    const add = (n: string) => s.addPerson(db, ADMIN, TEAM_ID, { displayName: `Pilot ${n}`, role: 'Tester', department: 'Digital', email: `pilot.${n}@example.test`, appRoles: [] });
    const a = await add('a'), b = await add('b'), c = await add('c');
    expect((await rowOf(a.id)).status).toBe('never');
    expect((await rowOf(a.id)).lastActive).toBeNull();
    // A Google sign-in before visits were kept left only its photo: that counts as signed in.
    await db.query(`UPDATE people SET photo_url = 'https://example.test/a.png' WHERE id = $1`, [a.id]);
    expect((await rowOf(a.id)).status).toBe('quiet');
    // A change from before the live pilot (a task loaded from the old tracker under their name) is not a sign-in.
    const [task] = await s.teamTasks(db, TEAM_ID);
    await db.query(`INSERT INTO events (id, entity_type, entity_id, field, before, after, actor_id, origin, at)
      VALUES ('evt_old_b', 'task', $1, 'title', null, '"old title"', $2, 'app', '2026-09-01T10:00:00+05:30')`, [task.id, b.id]);
    expect((await rowOf(b.id)).status).toBe('never');
    // A visit three weeks ago: signed in, gone quiet, and outside the 14 dots.
    await db.exec(`INSERT INTO visit_days VALUES ('${b.id}', '2026-09-18')`);
    expect(await rowOf(b.id)).toMatchObject({ status: 'quiet', days: [], opened7: 0 });
    await db.exec(`INSERT INTO visit_days VALUES ('${b.id}', '2026-10-07')`);
    expect(await rowOf(b.id)).toMatchObject({ status: 'some', days: ['2026-10-07'], opened7: 1 });
    // Today is Fri 9 Oct, so Daily asks for Fri 2, Mon 5, Tue 6, Wed 7 and Thu 8. The weekend and today are not needed.
    await db.exec(`INSERT INTO visit_days VALUES ('${c.id}', '2026-10-02'), ('${c.id}', '2026-10-05'), ('${c.id}', '2026-10-06'), ('${c.id}', '2026-10-07')`);
    expect(await rowOf(c.id)).toMatchObject({ status: 'some', weekdays: 4 });
    await db.exec(`INSERT INTO visit_days VALUES ('${c.id}', '2026-10-08')`);
    expect(await rowOf(c.id)).toMatchObject({ status: 'daily', weekdays: 5 });
    const rows = await teamAdoption(scoped(db, TEAM_ID), TEAM_ID);
    const at = (id: string) => rows.findIndex((r) => r.id === id);
    expect(at(c.id)).toBeLessThan(at(b.id)); // Daily before Some days before the rest
  });

  it('lists only active people of the team', async () => {
    const rows = await teamAdoption(scoped(db, TEAM_ID), TEAM_ID);
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
