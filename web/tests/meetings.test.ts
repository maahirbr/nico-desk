import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Meeting rhythm and agenda per project (13 Oct): who may set it, the date maths for each frequency, the agenda
// the code builds, what a restricted person can see, the upgrade, and the routes during View as. Tests pin today to
// 2026-10-09, a Friday.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { COOKIE, VIEW_COOKIE, signSession, signView, type Me } from '../lib/auth';
import { MEETINGS_UPGRADE, openDb, upgrade, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { addComment } from '../lib/comments';
import {
  addMonths, firstMeetingDate, markMeetingHeld, meetingAgenda, meetsWords, nextAfterHeld, nextMeetingDate, setMeetingRhythm, snapToDay, weekdayOf,
  type Rhythm,
} from '../lib/meetings';
import { createProject, getProject } from '../lib/plan';
import * as s from '../lib/service';
import { TEAM_ID } from '../lib/seed';
import { GET as agendaRoute, PUT as rhythmRoute } from '../app/api/v1/projects/[id]/meeting/route';
import { POST as heldRoute } from '../app/api/v1/projects/[id]/meeting/held/route';

const TODAY = '2026-10-09'; // a Friday
const LEAD = 'per_ada'; // a team lead
const ADMIN = 'per_fay';
const OWNER = 'per_bo'; // a plain member
const OTHER = 'per_cy'; // a plain member with no tie to the project
const DEE = 'per_dee'; // restricted in the visibility test
let db: Db;

beforeAll(() => { process.env.NICO_SESSION_SECRET = 'meetings-test-secret'; });
beforeEach(async () => {
  db = await openDb();
  state.testDb = db;
  state.jar = {};
});

const none: Rhythm = { meetEvery: null, meetDay: null, meetNext: null, meetLast: null };
const r = (o: Partial<Rhythm>): Rhythm => ({ ...none, ...o });

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { if (e instanceof ApiError) return `${e.status} ${e.code}`; throw e; }
  return 'ok';
}
async function msg(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { if (e instanceof ApiError) return e.message; throw e; }
  return '';
}
async function meAs(id: string): Promise<Me> {
  const person = (await s.listPeople(db, TEAM_ID)).find((p) => p.id === id)!;
  return { person, realPerson: person, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } };
}

const base = { name: 'Gift wrap drive', kind: 'tasks' as const, ownerId: OWNER, goal: '', workstreams: [], members: [] };
// 15 Oct: only an admin sees every project, so the team lead is given view of each one made here.
const mk = async (over: Partial<typeof base> = {}) => {
  const p = await createProject(db, LEAD, TEAM_ID, { ...base, ...over });
  await db.query(`INSERT INTO project_viewers (project_id, person_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [p.id, LEAD]);
  return p;
};
const rhythmOf = async (id: string): Promise<Rhythm> => {
  const p = await getProject(db, id);
  return { meetEvery: p.meetEvery, meetDay: p.meetDay, meetNext: p.meetNext, meetLast: p.meetLast };
};

describe('the date maths', () => {
  it('works out the weekday and snaps forward to a weekday', () => {
    expect(weekdayOf('2026-10-09')).toBe(5); // Friday
    expect(weekdayOf('2026-10-11')).toBe(7); // Sunday
    expect(snapToDay('2026-10-09', 4)).toBe('2026-10-15'); // Friday to the next Thursday
    expect(snapToDay('2026-10-09', 5)).toBe('2026-10-09'); // already on it
    expect(snapToDay('2026-10-09', null)).toBe('2026-10-09');
  });

  it('adds months and keeps to the month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29'); // a leap year
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15'); // over the year end
    expect(addMonths('2026-02-28', 12)).toBe('2027-02-28');
    expect(addMonths('2026-02-28', 1, 31)).toBe('2026-03-31'); // back to the 31st after a short month
  });

  it('gives a first date for each frequency, and none for as needed', () => {
    expect(firstMeetingDate('weekly', null, TODAY)).toBe('2026-10-16');
    expect(firstMeetingDate('fortnightly', null, TODAY)).toBe('2026-10-23');
    expect(firstMeetingDate('monthly', null, TODAY)).toBe('2026-11-09');
    expect(firstMeetingDate('weekly', 4, TODAY)).toBe('2026-10-15'); // the next Thursday
    expect(firstMeetingDate('monthly', 1, TODAY)).toBe('2026-10-12'); // with a day set, the next one of that day
    expect(firstMeetingDate('as_needed', null, TODAY)).toBeNull();
  });

  it('keeps a stored date that is still ahead', () => {
    expect(nextMeetingDate(r({ meetEvery: 'weekly', meetDay: 4, meetNext: '2026-10-15' }), TODAY)).toBe('2026-10-15');
    expect(nextMeetingDate(r({ meetEvery: 'weekly', meetDay: 5, meetNext: TODAY }), TODAY)).toBe(TODAY); // today counts
  });

  it('rolls a past date forward by the frequency', () => {
    expect(nextMeetingDate(r({ meetEvery: 'weekly', meetDay: 4, meetNext: '2026-09-17' }), TODAY)).toBe('2026-10-15');
    expect(nextMeetingDate(r({ meetEvery: 'fortnightly', meetDay: 2, meetNext: '2026-09-15' }), TODAY)).toBe('2026-10-13');
    expect(nextMeetingDate(r({ meetEvery: 'fortnightly', meetDay: 2, meetNext: '2026-09-22' }), TODAY)).toBe('2026-10-20');
    expect(nextMeetingDate(r({ meetEvery: 'monthly', meetNext: '2026-07-31' }), TODAY)).toBe('2026-10-31');
    expect(nextMeetingDate(r({ meetEvery: 'monthly', meetNext: '2026-01-31' }), '2026-02-10')).toBe('2026-02-28');
  });

  it('starts from the last meeting when there is no stored date', () => {
    expect(nextMeetingDate(r({ meetEvery: 'weekly', meetDay: 4, meetLast: '2026-10-01' }), TODAY)).toBe('2026-10-15');
    expect(nextMeetingDate(r({ meetEvery: 'weekly', meetLast: '2026-10-08' }), TODAY)).toBe('2026-10-15');
    expect(nextMeetingDate(r({ meetEvery: 'weekly', meetDay: 3 }), TODAY)).toBe('2026-10-14'); // nothing stored: the next Wednesday
  });

  it('has no automatic date for as needed, and no date with no rhythm', () => {
    expect(nextMeetingDate(r({ meetEvery: 'as_needed' }), TODAY)).toBeNull();
    expect(nextMeetingDate(r({ meetEvery: 'as_needed', meetLast: '2026-10-01' }), TODAY)).toBeNull();
    expect(nextMeetingDate(r({ meetEvery: 'as_needed', meetNext: '2026-10-20' }), TODAY)).toBe('2026-10-20'); // set by hand
    expect(nextMeetingDate(r({ meetEvery: 'as_needed', meetNext: '2026-10-01' }), TODAY)).toBeNull(); // a past hand date does not roll
    expect(nextMeetingDate(none, TODAY)).toBeNull();
  });

  it('moves on after a meeting is held', () => {
    // The stored date was this week's meeting, held today: the next is a step on.
    expect(nextAfterHeld(r({ meetEvery: 'weekly', meetDay: 5, meetNext: TODAY }), TODAY)).toBe('2026-10-16');
    expect(nextAfterHeld(r({ meetEvery: 'weekly', meetDay: 4, meetNext: '2026-10-08' }), TODAY)).toBe('2026-10-15'); // it was late
    expect(nextAfterHeld(r({ meetEvery: 'weekly', meetDay: 4, meetNext: '2026-10-15' }), TODAY)).toBe('2026-10-22'); // a meeting held early
    expect(nextAfterHeld(r({ meetEvery: 'fortnightly', meetDay: 2, meetNext: '2026-10-20' }), TODAY)).toBe('2026-11-03'); // 11 days out is less than a step: this cycle's meeting
    expect(nextAfterHeld(r({ meetEvery: 'fortnightly', meetDay: 5, meetNext: '2026-10-23' }), TODAY)).toBe('2026-10-23'); // a whole step out: an extra meeting, keep the plan
    expect(nextAfterHeld(r({ meetEvery: 'monthly', meetNext: '2026-10-31' }), TODAY)).toBe('2026-11-30'); // a step on, clamped to the month end
    expect(nextAfterHeld(r({ meetEvery: 'monthly', meetNext: '2026-11-09' }), TODAY)).toBe('2026-11-09'); // a whole step out: keep it
    expect(nextAfterHeld(r({ meetEvery: 'as_needed', meetNext: '2026-10-20' }), TODAY)).toBeNull();
    expect(nextAfterHeld(none, TODAY)).toBeNull();
  });

  it('says it in a short line', () => {
    expect(meetsWords(r({ meetEvery: 'weekly', meetDay: 4, meetNext: '2026-10-15' }), TODAY)).toBe('Meets Thu, next 15 Oct');
    expect(meetsWords(r({ meetEvery: 'fortnightly', meetDay: 2, meetNext: '2026-10-20' }), TODAY)).toBe('Meets every other Tue, next 20 Oct');
    expect(meetsWords(r({ meetEvery: 'monthly', meetNext: '2026-10-31' }), TODAY)).toBe('Meets monthly, next 31 Oct');
    expect(meetsWords(r({ meetEvery: 'weekly', meetDay: 5, meetNext: TODAY }), TODAY)).toBe('Meets Fri, next today');
    expect(meetsWords(r({ meetEvery: 'as_needed' }), TODAY)).toBe('Meets as needed');
    expect(meetsWords(none, TODAY)).toBeNull();
  });
});

describe('who may set the rhythm and mark a meeting held', () => {
  it('lets the project owner, a team lead and an admin, and refuses everyone else', async () => {
    const p = await mk(); // owned by a plain member
    const put = (who: string) => setMeetingRhythm(db, who, p.id, { every: 'weekly', day: 4 }, TODAY);
    expect(await code(put(OTHER))).toBe('403 not_allowed');
    expect(await code(put(OWNER))).toBe('ok');
    expect(await code(put(LEAD))).toBe('ok');
    expect(await code(put(ADMIN))).toBe('ok');
    expect(await code(markMeetingHeld(db, OTHER, p.id, TODAY))).toBe('403 not_allowed');
    expect(await code(markMeetingHeld(db, OWNER, p.id, TODAY))).toBe('ok');
  });

  it('lets the project lead, who is not the owner and not a team lead', async () => {
    const p = await mk({ ownerId: LEAD });
    await db.query(`UPDATE projects SET lead_id = $2 WHERE id = $1`, [p.id, OTHER]);
    expect(await code(setMeetingRhythm(db, OTHER, p.id, { every: 'monthly' }, TODAY))).toBe('ok');
    expect(await code(markMeetingHeld(db, OTHER, p.id, TODAY))).toBe('ok');
    expect(await code(setMeetingRhythm(db, OWNER, p.id, { every: 'monthly' }, TODAY))).toBe('403 not_allowed');
  });

  it('refuses an archived project until it is restored', async () => {
    const p = await mk();
    await db.query(`UPDATE projects SET archived_at = now(), archived_by = $2 WHERE id = $1`, [p.id, LEAD]);
    expect(await code(setMeetingRhythm(db, LEAD, p.id, { every: 'weekly' }, TODAY))).toBe('400 project_archived');
    expect(await code(markMeetingHeld(db, LEAD, p.id, TODAY))).toBe('400 project_archived');
  });

  it('says no such project for an unknown id', async () => {
    expect(await code(setMeetingRhythm(db, LEAD, 'prj_nope', { every: 'weekly' }, TODAY))).toBe('404 not_found');
  });
});

describe('setting the rhythm', () => {
  it('works out the first date when none is given', async () => {
    const p = await mk();
    expect(await setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', day: 4 }, TODAY)).toEqual({ meetEvery: 'weekly', meetDay: 4, meetNext: '2026-10-15', meetLast: null });
    expect(await rhythmOf(p.id)).toEqual({ meetEvery: 'weekly', meetDay: 4, meetNext: '2026-10-15', meetLast: null });
    expect((await setMeetingRhythm(db, LEAD, p.id, { every: 'fortnightly' }, TODAY)).meetNext).toBe('2026-10-23');
  });

  it('keeps a date given by hand', async () => {
    const p = await mk();
    const out = await setMeetingRhythm(db, LEAD, p.id, { every: 'monthly', next: '2026-11-04' }, TODAY);
    expect(out.meetNext).toBe('2026-11-04');
  });

  it('leaves as needed with no day and no date, and clears everything for no rhythm', async () => {
    const p = await mk();
    expect(await setMeetingRhythm(db, LEAD, p.id, { every: 'as_needed', day: 3 }, TODAY)).toEqual({ meetEvery: 'as_needed', meetDay: null, meetNext: null, meetLast: null });
    await setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', day: 2 }, TODAY);
    expect(await setMeetingRhythm(db, LEAD, p.id, { every: null, day: 2, next: '2026-10-20' }, TODAY)).toEqual(none);
    expect(await rhythmOf(p.id)).toEqual(none);
  });

  it('refuses a past date, a bad weekday and a date on the wrong weekday, and says why', async () => {
    const p = await mk();
    expect(await msg(setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', next: '2026-10-01' }, TODAY))).toContain('today or later');
    expect(await code(setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', day: 9 }, TODAY))).toBe('400 invalid_body');
    expect(await code(setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', next: '2026-02-30' }, TODAY))).toBe('400 invalid_body');
    const wrong = await msg(setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', day: 2, next: '2026-10-15' }, TODAY));
    expect(wrong).toContain('Thursday');
    expect(wrong).toContain('Tuesday');
    expect((await rhythmOf(p.id)).meetEvery).toBeNull(); // nothing changed
  });

  it('writes an audit event on the project', async () => {
    const p = await mk();
    await setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', day: 4 }, TODAY);
    const { rows } = await db.query<{ field: string; actor_id: string }>(`SELECT field, actor_id FROM events WHERE entity_type = 'project' AND entity_id = $1`, [p.id]);
    expect(rows.map((x) => x.field)).toContain('meeting_rhythm');
    expect(rows.find((x) => x.field === 'meeting_rhythm')?.actor_id).toBe(LEAD);
  });
});

describe('marking a meeting held', () => {
  it('sets the last meeting to today and rolls the next date on', async () => {
    const p = await mk();
    await setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', day: 5, next: TODAY }, TODAY);
    const out = await markMeetingHeld(db, LEAD, p.id, TODAY);
    expect(out).toEqual({ meetEvery: 'weekly', meetDay: 5, meetNext: '2026-10-16', meetLast: TODAY });
    expect(await rhythmOf(p.id)).toEqual(out);
  });

  it('is refused a second time on the same day, and works again the next day', async () => {
    const p = await mk();
    await setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', day: 5, next: TODAY }, TODAY);
    await markMeetingHeld(db, LEAD, p.id, TODAY);
    expect(await code(markMeetingHeld(db, LEAD, p.id, TODAY))).toBe('400 already_held');
    expect(await code(markMeetingHeld(db, LEAD, p.id, '2026-10-10'))).toBe('ok');
  });

  it('records the date and sets no next date for as needed, or for no rhythm', async () => {
    const p = await mk();
    expect(await markMeetingHeld(db, LEAD, p.id, TODAY)).toEqual({ ...none, meetLast: TODAY });
    const q = await mk({ name: 'Another drive' });
    await setMeetingRhythm(db, LEAD, q.id, { every: 'as_needed', next: '2026-10-20' }, TODAY);
    expect(await markMeetingHeld(db, LEAD, q.id, TODAY)).toEqual({ meetEvery: 'as_needed', meetDay: null, meetNext: null, meetLast: TODAY });
  });

  it('logs the meeting on the project', async () => {
    const p = await mk();
    await markMeetingHeld(db, LEAD, p.id, TODAY);
    const { rows } = await db.query<{ field: string }>(`SELECT field FROM events WHERE entity_type = 'project' AND entity_id = $1`, [p.id]);
    expect(rows.map((x) => x.field)).toContain('meeting_held');
  });
});

describe('the agenda on a task board', () => {
  const sections = (a: Awaited<ReturnType<typeof meetingAgenda>>) => Object.fromEntries(a.sections.map((x) => [x.key, x.rows.map((y) => y.title)]));

  async function board() {
    const p = await mk({ ownerId: LEAD });
    const mkTask = (title: string, dueOn: string, ownerId = OWNER) => s.createTask(db, LEAD, { teamId: TEAM_ID, title, dueOn, ownerId, projectId: p.id });
    const late = await mkTask('Reprint the price cards', TODAY);
    await db.query(`UPDATE tasks SET due_on = '2026-10-02' WHERE id = $1`, [late.id]);
    const blocked = await mkTask('Book the courier', '2026-10-30');
    await s.blockTask(db, OWNER, blocked.id, { version: blocked.version, onId: OTHER, ask: 'Need the pickup slot' });
    const risk = await mkTask('Pack the first hamper', '2026-10-10'); // due tomorrow and not started
    const soon = await mkTask('Write the thank-you notes', '2026-10-14');
    await s.setHealth(db, OWNER, soon.id, { version: soon.version, health: 'on_track' }); // started, so not at risk
    const far = await mkTask('Plan the January sale', '2026-12-01');
    return { p, late, blocked, risk, soon, far };
  }

  it('lists late, blocked, at risk and due-before-the-next-meeting tasks, each once, in that order', async () => {
    const { p, late, blocked, risk, soon, far } = await board();
    await setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', day: 4, next: '2026-10-15' }, TODAY);
    const a = await meetingAgenda(db, await meAs(LEAD), p.id, TODAY);
    expect(a.sections.map((x) => x.key).slice(0, 4)).toEqual(['late', 'blocked', 'at_risk', 'soon']);
    const sec = sections(a);
    expect(sec.late).toEqual([late.title]);
    expect(sec.blocked).toEqual([blocked.title]);
    expect(sec.at_risk).toEqual([risk.title]);
    expect(sec.soon).toEqual([soon.title]);
    const all = Object.values(sec).flat();
    expect(all).not.toContain(far.title); // due after the next meeting and fine
    expect(all.filter((t) => t === late.title)).toHaveLength(1); // a task sits in one group
    expect(a.next).toBe('2026-10-15');
    expect(a.horizon).toBe('2026-10-15');
    expect(a.sections.find((x) => x.key === 'late')!.rows[0].note).toMatch(/7 days late, was due 2 Oct/);
    expect(a.sections.find((x) => x.key === 'blocked')!.rows[0].note).toContain('Need the pickup slot');
    expect(a.sections.find((x) => x.key === 'soon')!.title).toBe('Due before the next meeting');
  });

  it('looks seven days ahead when the project meets as needed', async () => {
    const { p, soon, far } = await board();
    await setMeetingRhythm(db, LEAD, p.id, { every: 'as_needed' }, TODAY);
    const a = await meetingAgenda(db, await meAs(LEAD), p.id, TODAY);
    expect(a.next).toBeNull();
    expect(a.horizon).toBe('2026-10-16');
    const all = Object.values(sections(a)).flat();
    expect(all).toContain(soon.title); // due 14 Oct: inside the seven days
    expect(all).not.toContain(far.title);
  });

  it('leaves out closed tasks from the open groups', async () => {
    const { p, late } = await board();
    await s.closeTask(db, OWNER, late.id, { version: (await s.getTask(db, late.id)).version, as: 'done' });
    const a = await meetingAgenda(db, await meAs(LEAD), p.id, TODAY);
    expect(sections(a).late ?? []).toEqual([]);
  });

  it('lists what changed, what finished and the new comments since the last meeting', async () => {
    const { p, late, risk } = await board();
    await setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', day: 4, next: '2026-10-15' }, TODAY);
    await db.query(`UPDATE projects SET meet_last = '2026-10-06' WHERE id = $1`, [p.id]);
    // A date moved by the lead on 8 Oct, a task finished on 8 Oct and a comment on 8 Oct: all after the meeting on 6 Oct.
    await s.renegotiate(db, LEAD, risk.id, { version: (await s.getTask(db, risk.id)).version, newDueOn: '2026-10-12', reason: 'Boxes arrive late' });
    const done = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Print the labels', dueOn: '2026-10-12', ownerId: OWNER, projectId: p.id });
    await s.closeTask(db, OWNER, done.id, { version: done.version, as: 'done' });
    await addComment(db, await meAs(LEAD), 'project', p.id, 'Courier prices went up, see the sheet.');
    await addComment(db, await meAs(LEAD), 'task', late.id, 'Waiting on the printer.');
    const old = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Sort the ribbons', dueOn: '2026-10-12', ownerId: OWNER, projectId: p.id });
    await s.closeTask(db, OWNER, old.id, { version: old.version, as: 'done' });
    const backdate = "'2026-10-08T06:00:00Z'";
    // events is append-only, so the trigger is off for the moment it takes to set the dates the story needs.
    await db.exec(`ALTER TABLE events DISABLE TRIGGER events_no_change`);
    await db.query(`UPDATE events SET at = ${backdate} WHERE entity_id IN ($1,$2,$3)`, [risk.id, done.id, late.id]);
    await db.query(`UPDATE tasks SET closed_at = ${backdate} WHERE id = $1`, [done.id]);
    await db.query(`UPDATE comments SET created_at = ${backdate} WHERE subject_id IN ($1,$2)`, [p.id, late.id]);
    // This one finished on the meeting day itself, which counts as discussed.
    await db.query(`UPDATE tasks SET closed_at = '2026-10-06T08:00:00Z' WHERE id = $1`, [old.id]);
    await db.query(`UPDATE events SET at = '2026-10-06T08:00:00Z' WHERE entity_id = $1`, [old.id]);
    await db.exec(`ALTER TABLE events ENABLE TRIGGER events_no_change`);

    const a = await meetingAgenda(db, await meAs(LEAD), p.id, TODAY);
    const sec = sections(a);
    expect(a.since).toBe('2026-10-07');
    expect(a.sections.find((x) => x.key === 'changed')!.title).toBe('Changed since 6 Oct');
    expect(sec.changed).toContain(risk.title);
    expect(sec.finished).toEqual([done.title]);
    expect(sec.finished).not.toContain(old.title);
    expect(sec.comments).toEqual(expect.arrayContaining(['Courier prices went up, see the sheet.', 'Waiting on the printer.']));
    expect(a.sections.find((x) => x.key === 'comments')!.rows.find((x) => x.title.startsWith('Waiting'))!.note).toContain('Reprint the price cards');
    // A section the board has nothing for is left out, and the total adds up.
    expect(a.total).toBe(a.sections.reduce((n, x) => n + x.rows.length + x.more, 0));
  });

  it('caps a long section and says how many more', async () => {
    const p = await mk({ ownerId: LEAD });
    for (let i = 0; i < 28; i++) {
      const t = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: `Late job ${String(i).padStart(2, '0')}`, dueOn: TODAY, ownerId: OWNER, projectId: p.id });
      await db.query(`UPDATE tasks SET due_on = '2026-10-01' WHERE id = $1`, [t.id]);
    }
    const a = await meetingAgenda(db, await meAs(LEAD), p.id, TODAY);
    const late = a.sections.find((x) => x.key === 'late')!;
    expect(late.rows).toHaveLength(25);
    expect(late.more).toBe(3);
    expect(a.total).toBe(28);
  });

  it('is empty for a quiet project', async () => {
    const p = await mk();
    const a = await meetingAgenda(db, await meAs(LEAD), p.id, TODAY);
    expect(a.sections).toEqual([]);
    expect(a.total).toBe(0);
  });
});

describe('the agenda on a plan board', () => {
  it('lists open asks and actions, late and blocked lines, and leaves out what is done', async () => {
    const asks = await db.query<{ id: string; short: string; done: boolean }>(`SELECT id, short, done FROM plan_asks WHERE project_id = 'prj_studio' ORDER BY position`);
    expect(asks.rows.length).toBeGreaterThan(1); // the fixture has several
    const done = asks.rows[0];
    await db.query(`UPDATE plan_asks SET done = true, done_on = $2 WHERE id = $1`, [done.id, TODAY]);
    const open = asks.rows.slice(1).filter((x) => !x.done).map((x) => x.short);
    const a = await meetingAgenda(db, await meAs(LEAD), 'prj_studio', TODAY);
    const askRows = a.sections.find((x) => x.key === 'asks')!.rows.map((x) => x.title);
    expect(askRows).toEqual(expect.arrayContaining(open));
    expect(askRows).not.toContain(done.short);
    expect(a.sections.every((x) => x.rows.every((y) => y.taskId === null || x.key !== 'asks'))).toBe(true);
  });

  it('turns a plan line off course into a row', async () => {
    const { rows } = await db.query<{ id: string }>(`SELECT id FROM plan_lines WHERE project_id = 'prj_studio' ORDER BY num LIMIT 1`);
    await db.query(`UPDATE plan_lines SET status = 'Blocked' WHERE id = $1`, [rows[0].id]);
    const a = await meetingAgenda(db, await meAs(LEAD), 'prj_studio', TODAY);
    const lines = a.sections.find((x) => x.key === 'lines')!;
    expect(lines.rows.some((x) => x.id === rows[0].id && /Blocked/.test(x.note))).toBe(true);
  });
});

describe('who sees the agenda', () => {
  it('reads a hidden project as missing to a restricted person, and shows a project they belong to', async () => {
    await db.query(`UPDATE people SET restricted = true WHERE id = $1`, [DEE]);
    await db.query(`UPDATE projects SET meet_every = 'weekly', meet_day = 4, meet_next = '2026-10-15' WHERE id = 'prj_tiers'`);
    const dee = await meAs(DEE);
    expect(await code(meetingAgenda(db, dee, 'prj_tiers', TODAY))).toMatch(/^(403|404) /);
    const mine = await meetingAgenda(db, dee, 'prj_shoot', TODAY);
    expect(mine.projectId).toBe('prj_shoot');
    expect(mine.next).toBe('2026-10-20');
  });

  it('never shows a comment or a task from another project', async () => {
    const p = await mk({ ownerId: LEAD, name: 'First drive' });
    const q = await mk({ ownerId: LEAD, name: 'Second drive' });
    const t = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Only in the second', dueOn: TODAY, ownerId: OWNER, projectId: q.id });
    await db.query(`UPDATE tasks SET due_on = '2026-10-01' WHERE id = $1`, [t.id]);
    await addComment(db, await meAs(LEAD), 'project', q.id, 'A note for the second drive.');
    const a = await meetingAgenda(db, await meAs(LEAD), p.id, TODAY);
    expect(a.sections).toEqual([]);
  });
});

describe('the fixtures', () => {
  it('give three projects a rhythm and leave one without', async () => {
    const rows = (await db.query<{ id: string; meet_every: string | null; meet_day: number | null; meet_next: string | null; meet_last: string | null }>(
      `SELECT id, meet_every, meet_day, meet_next::text, meet_last::text FROM projects ORDER BY id`)).rows;
    const by = Object.fromEntries(rows.map((x) => [x.id, x]));
    expect(by.prj_landing).toMatchObject({ meet_every: 'weekly', meet_day: 4 });
    expect(by.prj_shoot).toMatchObject({ meet_every: 'fortnightly', meet_day: 2, meet_next: '2026-10-20' });
    expect(by.prj_studio).toMatchObject({ meet_every: 'weekly', meet_day: 3 });
    expect(by.prj_tiers.meet_every).toBeNull();
    // Each stored day agrees with its stored date.
    for (const x of rows.filter((y) => y.meet_day && y.meet_next)) expect(weekdayOf(x.meet_next!)).toBe(x.meet_day);
  });
});

describe('the upgrade', () => {
  it('can run again on an upgraded database and keeps the rhythm', async () => {
    const p = await mk();
    await setMeetingRhythm(db, LEAD, p.id, { every: 'weekly', day: 4 }, TODAY);
    await upgrade(db);
    await upgrade(db);
    await db.exec(MEETINGS_UPGRADE);
    expect((await rhythmOf(p.id)).meetEvery).toBe('weekly');
  });

  it('adds the columns to a database made before it, and keeps the data', async () => {
    await db.exec(`ALTER TABLE projects DROP COLUMN meet_every; ALTER TABLE projects DROP COLUMN meet_day;
      ALTER TABLE projects DROP COLUMN meet_next; ALTER TABLE projects DROP COLUMN meet_last;`);
    await upgrade(db);
    const p = await getProject(db, 'prj_landing');
    expect(p.meetEvery).toBeNull();
    expect(p.name).toBeTruthy();
    expect(await code(setMeetingRhythm(db, LEAD, 'prj_landing', { every: 'monthly' }, TODAY))).toBe('ok');
  });

  it('adds no table, so there is no new row level security step (projects already has it on the host)', () => {
    expect(MEETINGS_UPGRADE).not.toMatch(/CREATE TABLE/i);
    expect(MEETINGS_UPGRADE.match(/ADD COLUMN IF NOT EXISTS/g)).toHaveLength(4);
  });

  it('refuses a rhythm word the table does not know', async () => {
    await expect(db.query(`UPDATE projects SET meet_every = 'daily' WHERE id = 'prj_landing'`)).rejects.toThrow();
    await expect(db.query(`UPDATE projects SET meet_day = 8 WHERE id = 'prj_landing'`)).rejects.toThrow();
  });
});

describe('the routes', () => {
  const req = (url: string, method: string, body?: unknown) =>
    new Request(`http://localhost${url}`, {
      method, headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it('sets the rhythm, marks held, and reads the agenda for a lead', async () => {
    const p = await mk();
    state.jar = { [COOKIE]: signSession(LEAD) };
    const put = await rhythmRoute(req(`/api/v1/projects/${p.id}/meeting`, 'PUT', { every: 'weekly', day: 4, next: '2026-10-15' }), params(p.id));
    expect(put.status).toBe(200);
    expect((await rhythmOf(p.id)).meetNext).toBe('2026-10-15');
    const got = await agendaRoute(req(`/api/v1/projects/${p.id}/meeting`, 'GET'), params(p.id));
    expect(got.status).toBe(200);
    expect((await got.json()).projectId).toBe(p.id);
    const held = await heldRoute(req(`/api/v1/projects/${p.id}/meeting/held`, 'POST', {}), params(p.id));
    expect(held.status).toBe(200);
    expect((await rhythmOf(p.id)).meetLast).toBeTruthy();
  });

  it('refuses a bad body with 400 and a member who has no right with 403', async () => {
    const p = await mk();
    state.jar = { [COOKIE]: signSession(LEAD) };
    expect((await rhythmRoute(req(`/api/v1/projects/${p.id}/meeting`, 'PUT', { every: 'daily' }), params(p.id))).status).toBe(400);
    expect((await rhythmRoute(req(`/api/v1/projects/${p.id}/meeting`, 'PUT', { every: 'weekly', day: 8 }), params(p.id))).status).toBe(400);
    state.jar = { [COOKIE]: signSession(OTHER) };
    expect((await rhythmRoute(req(`/api/v1/projects/${p.id}/meeting`, 'PUT', { every: 'weekly' }), params(p.id))).status).toBe(404); // cannot see it
    await db.query(`INSERT INTO project_viewers (project_id, person_id) VALUES ($1, $2)`, [p.id, OTHER]); // sees it, may not run it
    expect((await rhythmRoute(req(`/api/v1/projects/${p.id}/meeting`, 'PUT', { every: 'weekly' }), params(p.id))).status).toBe(403);
    expect((await heldRoute(req(`/api/v1/projects/${p.id}/meeting/held`, 'POST', {}), params(p.id))).status).toBe(403);
    expect((await rhythmOf(p.id)).meetEvery).toBeNull();
  });

  it('refuses both writes during View as with 403 viewing_as, and changes nothing', async () => {
    const p = await mk();
    state.jar = { [COOKIE]: signSession(ADMIN), [VIEW_COOKIE]: signView(ADMIN, LEAD) };
    const put = await rhythmRoute(req(`/api/v1/projects/${p.id}/meeting`, 'PUT', { every: 'weekly' }), params(p.id));
    expect(put.status).toBe(403);
    expect((await put.json()).error.code).toBe('viewing_as');
    const held = await heldRoute(req(`/api/v1/projects/${p.id}/meeting/held`, 'POST', {}), params(p.id));
    expect(held.status).toBe(403);
    expect(await rhythmOf(p.id)).toEqual(none);
    // Reading the agenda is still allowed.
    expect((await agendaRoute(req(`/api/v1/projects/${p.id}/meeting`, 'GET'), params(p.id))).status).toBe(200);
  });
});
