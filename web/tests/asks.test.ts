import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { addDays } from '../lib/time';

// v2: the ask. "Today" is the fixtures' as-of date.
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

async function code(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof ApiError) return `${e.status} ${e.code}`;
    throw e;
  }
  return 'ok';
}

const ask = (from = LEAD, to = BO, dueOn = addDays(AS_OF, 4), title = 'Send the packaging proofs') =>
  s.createAsk(db, from, { teamId: TEAM_ID, title, toId: to, dueOn });
const onDesk = async (id: string) => (await s.teamTasks(db, TEAM_ID, AS_OF)).some((t) => t.id === id);
const fields = async (id: string) => (await s.taskLog(db, id)).map((e) => e.field).reverse();

describe('asking', () => {
  it('makes a pending ask that is off the desk, with its events', async () => {
    const a = await ask();
    expect(a.ask).toMatchObject({ state: 'asked', askedBy: LEAD, requestedOn: addDays(AS_OF, 4), counterOn: null });
    expect(a.ownerId).toBe(BO);
    expect(await onDesk(a.id)).toBe(false);
    expect(await fields(a.id)).toEqual(['_created', 'ask_state']);
    const mine = await s.listAsks(db, TEAM_ID, BO, AS_OF);
    expect(mine.ofMe.map((x) => x.id)).toContain(a.id);
    const theirs = await s.listAsks(db, TEAM_ID, LEAD, AS_OF);
    expect(theirs.byMe.find((x) => x.id === a.id)?.ask?.state).toBe('asked');
    expect(theirs.ofMe.map((x) => x.id)).not.toContain(a.id);
  });

  it('refuses an ask to yourself, in the past, or to someone off the roster', async () => {
    expect(await code(ask(LEAD, LEAD))).toBe('400 invalid_body');
    expect(await code(ask(LEAD, BO, addDays(AS_OF, -1)))).toBe('400 date_in_past');
    expect(await code(ask(LEAD, 'per_nobody'))).toBe('400 owner_not_on_roster');
  });

  it('keeps a pending ask out of reminders and out of the ordinary task edits', async () => {
    const a = await ask(LEAD, BO, AS_OF);
    const before = await db.query(`SELECT count(*)::int AS n FROM notices WHERE task_id = $1`, [a.id]);
    await s.runReminders(db, AS_OF);
    const after = await db.query(`SELECT count(*)::int AS n FROM notices WHERE task_id = $1`, [a.id]);
    expect(after.rows[0]).toEqual(before.rows[0]);
    expect(await code(s.editTask(db, BO, a.id, { version: a.version, title: 'Something else' }))).toBe('400 ask_open');
  });
});

describe('Yes, by then', () => {
  it('sets the first date once, to the date asked, and puts the task on the desk', async () => {
    const due = addDays(AS_OF, 4);
    const a = await ask(LEAD, BO, due);
    const t = await s.answerAsk(db, BO, a.id, { version: a.version, answer: 'yes' });
    expect(t.ask?.state).toBe('accepted');
    expect([t.firstDueOn, t.dueOn, t.dateMoves]).toEqual([due, due, 0]);
    expect(await onDesk(a.id)).toBe(true);
    const log = await s.taskLog(db, a.id);
    expect(log.map((e) => e.field).reverse()).toEqual(['_created', 'ask_state', 'ask_state', 'first_due_on']);
    expect(log.find((e) => e.field === 'first_due_on')).toMatchObject({ after: due, actor_id: BO });
    expect(log.some((e) => e.field === 'due_on')).toBe(false); // an agreement is not a renegotiation
  });

  it('keeps the first date locked after that, even for a later date move', async () => {
    const due = addDays(AS_OF, 4);
    const a = await ask(LEAD, BO, due);
    const t = await s.answerAsk(db, BO, a.id, { version: a.version, answer: 'yes' });
    const moved = await s.renegotiate(db, BO, a.id, { version: t.version, newDueOn: addDays(AS_OF, 9), reason: 'The printer needs longer.' });
    expect([moved.firstDueOn, moved.dueOn, moved.dateMoves]).toEqual([due, addDays(AS_OF, 9), 1]);
    await expect(db.query(`UPDATE tasks SET first_due_on = $2 WHERE id = $1`, [a.id, addDays(AS_OF, 20)])).rejects.toThrow(/first_due_on is locked/);
  });

  it('lets only the person asked answer, once, on the current version', async () => {
    const a = await ask();
    expect(await code(s.answerAsk(db, LEAD, a.id, { version: a.version, answer: 'yes' }))).toBe('403 not_allowed');
    expect(await code(s.answerAsk(db, CY, a.id, { version: a.version, answer: 'yes' }))).toBe('403 not_allowed');
    expect(await code(s.answerAsk(db, BO, a.id, { version: a.version + 1, answer: 'yes' }))).toBe('409 version_conflict');
    const t = await s.answerAsk(db, BO, a.id, { version: a.version, answer: 'yes' });
    expect(await code(s.answerAsk(db, BO, a.id, { version: t.version, answer: 'yes' }))).toBe('400 ask_state');
  });
});

describe('Not by then', () => {
  it('holds the ask on the counter date until the asker decides', async () => {
    const a = await ask(LEAD, BO, addDays(AS_OF, 3));
    const counter = addDays(AS_OF, 7);
    const c = await s.answerAsk(db, BO, a.id, { version: a.version, answer: 'counter', counterOn: counter, reason: 'The brief is not signed.' });
    expect(c.ask).toMatchObject({ state: 'countered', counterOn: counter, requestedOn: addDays(AS_OF, 3) });
    expect(await onDesk(a.id)).toBe(false);
    expect((await s.listAsks(db, TEAM_ID, LEAD, AS_OF)).byMe.find((x) => x.id === a.id)?.ask?.state).toBe('countered');
    expect((await s.listAsks(db, TEAM_ID, BO, AS_OF)).ofMe.map((x) => x.id)).not.toContain(a.id); // nothing for BO to answer now
    const log = await s.taskLog(db, a.id);
    expect(log.find((e) => e.field === 'ask_counter_on')).toMatchObject({ after: counter });
    expect(log.find((e) => e.field === 'ask_state' && e.after === 'countered')?.reason).toBe('The brief is not signed.');
  });

  it('needs a different date, and one that is not in the past', async () => {
    const a = await ask(LEAD, BO, addDays(AS_OF, 3));
    expect(await code(s.answerAsk(db, BO, a.id, { version: a.version, answer: 'counter', counterOn: addDays(AS_OF, 3) }))).toBe('400 invalid_body');
    expect(await code(s.answerAsk(db, BO, a.id, { version: a.version, answer: 'counter', counterOn: addDays(AS_OF, -1) }))).toBe('400 date_in_past');
  });

  it('sets the first date to the counter date when the asker accepts', async () => {
    const a = await ask(LEAD, BO, addDays(AS_OF, 3));
    const counter = addDays(AS_OF, 7);
    const c = await s.answerAsk(db, BO, a.id, { version: a.version, answer: 'counter', counterOn: counter });
    expect(await code(s.respondToCounter(db, BO, a.id, { version: c.version, accept: true }))).toBe('403 not_allowed'); // not the asked person
    const t = await s.respondToCounter(db, LEAD, a.id, { version: c.version, accept: true });
    expect(t.ask?.state).toBe('accepted');
    expect([t.firstDueOn, t.dueOn, t.dateMoves]).toEqual([counter, counter, 0]);
    expect(await onDesk(a.id)).toBe(true);
    const log = await s.taskLog(db, a.id);
    expect(log.find((e) => e.field === 'first_due_on')).toMatchObject({ before: addDays(AS_OF, 3), after: counter, actor_id: LEAD });
    expect(await code(s.respondToCounter(db, LEAD, a.id, { version: t.version, accept: true }))).toBe('400 ask_state');
  });

  it('closes the ask without a task when the asker declines', async () => {
    const a = await ask(LEAD, BO, addDays(AS_OF, 3));
    const c = await s.answerAsk(db, BO, a.id, { version: a.version, answer: 'counter', counterOn: addDays(AS_OF, 8) });
    const t = await s.respondToCounter(db, LEAD, a.id, { version: c.version, accept: false, reason: 'Too late for the launch.' });
    expect(t.ask?.state).toBe('declined');
    expect(await onDesk(a.id)).toBe(false);
    expect((await s.taskLog(db, a.id))[0]).toMatchObject({ field: 'ask_state', after: 'declined', reason: 'Too late for the launch.' });
    const byMe = (await s.listAsks(db, TEAM_ID, LEAD, AS_OF)).byMe;
    expect(byMe.find((x) => x.id === a.id)?.ask?.state).toBe('declined'); // seen for a week
  });

  it('refuses a decision when there is no counter date', async () => {
    const a = await ask();
    expect(await code(s.respondToCounter(db, LEAD, a.id, { version: a.version, accept: true }))).toBe('400 ask_state');
  });
});

describe('Can’t', () => {
  it('needs a reason, keeps it, and leaves the desk alone', async () => {
    const a = await ask();
    expect(await code(s.answerAsk(db, BO, a.id, { version: a.version, answer: 'cant', reason: 'no' }))).toBe('400 reason_required');
    const t = await s.answerAsk(db, BO, a.id, { version: a.version, answer: 'cant', reason: 'I am on leave that week.' });
    expect(t.ask).toMatchObject({ state: 'cant', reason: 'I am on leave that week.' });
    expect(await onDesk(a.id)).toBe(false);
    expect((await s.taskLog(db, a.id))[0]).toMatchObject({ field: 'ask_state', after: 'cant', reason: 'I am on leave that week.' });
    expect((await s.listAsks(db, TEAM_ID, LEAD, AS_OF)).byMe.find((x) => x.id === a.id)?.ask?.reason).toBe('I am on leave that week.');
  });
});

describe('the demo asks and the schema', () => {
  it('seeds asks for the lead in both sections, and none on the desk until agreed', async () => {
    const mine = await s.listAsks(db, TEAM_ID, LEAD, AS_OF);
    expect(mine.ofMe.length).toBeGreaterThanOrEqual(2);
    expect(mine.byMe.map((x) => x.ask?.state)).toEqual(expect.arrayContaining(['asked', 'countered', 'cant']));
    const desk = await s.teamTasks(db, TEAM_ID, AS_OF);
    expect(desk.filter((t) => t.ask && t.ask.state !== 'accepted')).toEqual([]);
  });

  it('upgrades a stored database again without error', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nd-ask-'));
    try {
      await openDb(dir);
      const again = await openDb(dir);
      const { rows } = await again.query(`SELECT count(*)::int AS n FROM tasks WHERE ask_state IS NOT NULL`);
      expect(rows[0].n).toBeGreaterThan(0);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
