import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { openDb, type Db } from '../lib/db';
import type { Task } from '../lib/derive';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { addDays, mondayOf } from '../lib/time';

// v2: the desk as it stood at the end of an earlier week, rebuilt from the events log.
// "Today" is a Friday. Edits are made at set moments (fake clock), a snapshot is taken after each,
// and the rebuild for that week must match the snapshot, whatever happened later.
const AS_OF = '2026-10-09';
const LEAD = 'per_ada';
const BO = 'per_bo';
const CY = 'per_cy';

let db: Db;

beforeAll(() => {
  process.env.NICO_TODAY = AS_OF;
});
beforeEach(async () => {
  db = await openDb();
});
afterEach(() => {
  vi.useRealTimers();
  process.env.NICO_TODAY = AS_OF;
});

const at = (iso: string) => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${iso}+05:30`));
};
// What a reader sees of a task. Version and timestamps differ by design, so they stay out.
const look = (t: Task) => ({
  title: t.title, ownerId: t.ownerId, dueOn: t.dueOn, firstDueOn: t.firstDueOn, statusCategory: t.statusCategory,
  health: t.health, blockedAsk: t.blocked?.ask ?? null, blockedOn: t.blocked?.onId ?? null, moved: t.renegotiations.length,
});
const find = async (week: string, id: string) => (await s.asOfTasks(db, TEAM_ID, week)).find((t) => t.id === id);
const eventCount = async () => ((await db.query(`SELECT count(*)::int AS n FROM events`)).rows[0] as { n: number }).n;

describe('weeks', () => {
  it('lists the last eight finished weeks as Mondays, newest first', () => {
    const w = s.asOfWeeks(AS_OF);
    expect(w).toHaveLength(8);
    expect(w[0]).toBe(addDays(mondayOf(AS_OF), -7));
    expect(w[7]).toBe(addDays(mondayOf(AS_OF), -56));
    expect(w.every((d) => new Date(`${d}T00:00:00Z`).getUTCDay() === 1)).toBe(true);
  });

  it('ends a week at midnight India time on the next Monday', () => {
    expect(s.weekEndCutoff('2026-10-05')).toBe('2026-10-11T18:30:00.000Z');
  });
});

describe('the desk as of a week', () => {
  it('matches what was true then and ignores what came after', async () => {
    // Week of Mon 5 Oct: made, due Thu 15 Oct.
    at('2026-10-06T10:00:00');
    const made = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Print the festival labels', ownerId: BO, dueOn: '2026-10-15' });
    const snap1 = look(await s.getTask(db, made.id));
    // Week of Mon 12 Oct: started, moved to 22 Oct, blocked, and the title fixed.
    at('2026-10-13T11:00:00');
    let t = await s.getTask(db, made.id);
    t = await s.setHealth(db, BO, made.id, { version: t.version, health: 'on_track' });
    at('2026-10-14T11:00:00');
    t = await s.renegotiate(db, BO, made.id, { version: t.version, newDueOn: '2026-10-22', reason: 'The printer needs longer.' });
    at('2026-10-15T11:00:00');
    t = await s.blockTask(db, BO, made.id, { version: t.version, onId: CY, ask: 'Need the final artwork' });
    t = await s.editTask(db, LEAD, made.id, { version: t.version, title: 'Print the festival labels, two sizes' });
    const snap2 = look(await s.getTask(db, made.id));
    // Week of Mon 19 Oct: unblocked and done.
    at('2026-10-21T09:00:00');
    t = await s.unblockTask(db, BO, made.id, { version: t.version, note: 'Artwork arrived' });
    t = await s.closeTask(db, BO, made.id, { version: t.version, as: 'done' });
    const snap3 = look(await s.getTask(db, made.id));
    expect(snap3.statusCategory).toBe('done');

    // Later, in the week of Mon 26 Oct, the rebuilds are read.
    at('2026-10-30T10:00:00');
    const before = await eventCount();
    expect(await find('2026-09-28', made.id)).toBeUndefined(); // not made yet
    expect(look((await find('2026-10-05', made.id))!)).toEqual(snap1);
    expect(look((await find('2026-10-12', made.id))!)).toEqual(snap2);
    expect(look((await find('2026-10-19', made.id))!)).toEqual(snap3);
    expect((await find('2026-10-12', made.id))!.dueOn).toBe('2026-10-22');
    expect((await find('2026-10-05', made.id))!.dueOn).toBe('2026-10-15');
    expect((await find('2026-10-12', made.id))!.blocked?.ask).toBe('Need the final artwork');
    expect((await find('2026-10-19', made.id))!.blocked).toBeNull();
    expect(await eventCount()).toBe(before); // reading writes nothing
    expect(look(await s.getTask(db, made.id))).toEqual(snap3); // the live task is untouched
  });

  it('judges late against the end of that week', async () => {
    process.env.NICO_TODAY = '2026-10-06'; // a task cannot be made already late, so make it on the day
    at('2026-10-06T10:00:00');
    const made = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Send the vendor list', ownerId: BO, dueOn: '2026-10-08' });
    at('2026-10-30T10:00:00');
    expect((await find('2026-10-05', made.id))!.overdue).toBe(true); // due Thu 8 Oct, open on Sun 11 Oct
    expect((await find('2026-10-05', made.id))!.dueOn).toBe('2026-10-08');
  });

  it('keeps a pending ask off the desk, and shows it from the week it was agreed', async () => {
    at('2026-10-06T10:00:00');
    const a = await s.createAsk(db, LEAD, { teamId: TEAM_ID, title: 'Book the studio', toId: BO, dueOn: '2026-10-20' });
    at('2026-10-14T10:00:00');
    await s.answerAsk(db, BO, a.id, { version: a.version, answer: 'yes' });
    at('2026-10-30T10:00:00');
    expect(await find('2026-10-05', a.id)).toBeUndefined(); // asked, not agreed
    expect((await find('2026-10-12', a.id))?.title).toBe('Book the studio'); // agreed that week
    expect((await find('2026-10-12', a.id))?.dueOn).toBe('2026-10-20');
  });

  it('gives one row per task for every one of the last weeks', async () => {
    for (const w of s.asOfWeeks(AS_OF)) {
      const rebuilt = await s.asOfTasks(db, TEAM_ID, w);
      expect(new Set(rebuilt.map((t) => t.id)).size).toBe(rebuilt.length);
    }
    expect((await s.asOfTasks(db, TEAM_ID, s.asOfWeeks(AS_OF)[0])).length).toBeGreaterThan(0);
  });
});

describe('load', () => {
  it('counts open work per person for this week and the next, with late work in this week', async () => {
    const week = '2026-10-05'; // Mon 5 to Sun 11 Oct; next week is 12 to 18 Oct
    process.env.NICO_TODAY = '2026-10-01'; // dates in the past cannot be set, so work as of then
    at('2026-10-01T10:00:00');
    const mk = (title: string, ownerId: string, dueOn: string) => s.createTask(db, LEAD, { teamId: TEAM_ID, title, ownerId, dueOn });
    const a = await mk('Late one', BO, '2026-10-02');
    const b = await mk('Mid week', BO, '2026-10-07');
    const c = await mk('Sunday', BO, '2026-10-11');
    const d = await mk('Next Monday', BO, '2026-10-12');
    const e = await mk('Next Sunday', BO, '2026-10-18');
    const far = await mk('The week after', BO, '2026-10-19'); // outside both
    const g = await mk('Cy this week', CY, '2026-10-09');
    const done = await mk('Already done', CY, '2026-10-08');
    process.env.NICO_TODAY = '2026-10-03';
    at('2026-10-03T10:00:00');
    await s.closeTask(db, CY, done.id, { version: done.version, as: 'done' });
    at('2026-10-30T10:00:00');

    const mine = new Set([a, b, c, d, e, far, g, done].map((x) => x.id));
    const rebuilt = (await s.asOfTasks(db, TEAM_ID, week)).filter((t) => mine.has(t.id)); // the seed has its own tasks
    const load = s.weeklyLoad(rebuilt, [BO, CY, LEAD], week);
    expect(load.map((l) => l.personId)).toEqual([BO, CY, LEAD]);
    const bo = load.find((l) => l.personId === BO)!;
    expect(bo.thisWeek.map((t) => t.id)).toEqual([a.id, b.id, c.id]);
    expect(bo.nextWeek.map((t) => t.id)).toEqual([d.id, e.id]);
    expect(bo.late).toBe(1);
    const cy = load.find((l) => l.personId === CY)!;
    expect(cy.thisWeek.map((t) => t.id)).toEqual([g.id]); // the done one does not count
    expect(cy.nextWeek).toEqual([]);
    expect(cy.late).toBe(0);
  });
});
