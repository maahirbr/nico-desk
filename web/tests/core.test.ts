import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { TEAM_ID } from '../lib/seed';
import { derive, type EventRow, type TaskRow } from '../lib/derive';
import * as s from '../lib/service';

// Acceptance checks from SPEC.md 7.2, on the synthetic fixtures. "Today" is the fixtures' as-of date.
const AS_OF = '2026-10-09';
const LEAD = 'per_ada';
const ADMIN = 'per_fay';

let db: Db;

beforeAll(() => {
  process.env.NICO_TODAY = AS_OF;
});
beforeEach(async () => {
  db = await openDb(); // fresh in-memory Postgres, seeded
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

async function openAppTask() {
  const all = await s.teamTasks(db, TEAM_ID, AS_OF);
  const t = all.find((x) => x.statusCategory === 'open' && x.origin === 'app' && x.ownerId !== LEAD);
  if (!t) throw new Error('fixture has no open app task');
  return t;
}

describe('ledger (FR-33, SPEC.md C1)', () => {
  it('matches the fixture totals, judged against the first date', async () => {
    const rows = await s.ledger(db, TEAM_ID, '2026-01-05', '2026-12-28', undefined, AS_OF);
    const sum = (k: keyof s.LedgerRow) => rows.reduce((n, r) => n + (r[k] as number), 0);
    expect(sum('closedAhead') + sum('closedOnTime')).toBe(27);
    expect(sum('closedLate')).toBe(10);
    expect(sum('openPastDue')).toBe(4);
  });

  it('judges tsk_008 late and tsk_017 on time', async () => {
    const t8 = await s.getTask(db, 'tsk_008', AS_OF);
    expect([t8.firstDueOn, t8.dueOn, t8.dateMoves]).toEqual(['2026-09-23', '2026-09-26', 1]);
    expect(t8.outcome).toBe('late');
    expect(t8.metRevisedDate).toBe(true);
    const t17 = await s.getTask(db, 'tsk_017', AS_OF);
    expect(t17.outcome).toBe('on_time');
    expect(t17.metRevisedDate).toBe(false);
  });
});

describe('late split: flagged early versus missed', () => {
  const row = (closedAt: string): TaskRow => ({
    id: 't', team_id: 'tm', title: 'x', description: null, owner_id: 'o', project_id: null, workstream: null,
    first_due_on: '2026-09-23', due_on: '2026-09-30', note: null, health: null, status: 'Done', status_category: 'done',
    priority: null, priority_set_by: null, priority_set_at: null, blocked_on_id: null, blocked_ask: null, blocked_at: null,
    origin: 'app', origin_ref: null, created_by: null, created_at: '2026-09-01T05:00:00Z', closed_at: closedAt, version: 1,
  });
  const move = (id: string, at: string, before: string, after: string): EventRow => ({
    id, entity_type: 'task', entity_id: 't', field: 'due_on', before, after, reason: 'r', actor_id: 'o', origin: 'app', at,
  });

  it('calls a move on or before the first date flagged early', () => {
    const t = derive(row('2026-09-29T05:00:00Z'), [move('e1', '2026-09-22T05:00:00Z', '2026-09-23', '2026-09-30')], AS_OF);
    expect([t.outcome, t.lateKind]).toEqual(['late', 'flagged_early']);
  });

  it('calls a move after the date passed, or no move, missed', () => {
    const lateMove = derive(row('2026-09-29T05:00:00Z'), [move('e1', '2026-09-25T05:00:00Z', '2026-09-23', '2026-09-30')], AS_OF);
    expect([lateMove.outcome, lateMove.lateKind]).toEqual(['late', 'missed']);
    const none = derive(row('2026-09-29T05:00:00Z'), [], AS_OF);
    expect([none.outcome, none.lateKind]).toEqual(['late', 'missed']);
  });

  it('has no late kind unless the task closed late, and the ledger split adds up', async () => {
    const early = derive(row('2026-09-22T05:00:00Z'), [], AS_OF);
    expect([early.outcome, early.lateKind]).toEqual(['ahead', null]);
    const rows = await s.ledger(db, TEAM_ID, '2026-01-05', '2026-12-28', undefined, AS_OF);
    const sum = (k: keyof s.LedgerRow) => rows.reduce((n, r) => n + (r[k] as number), 0);
    expect(sum('closedLateFlagged') + sum('closedLateMissed')).toBe(sum('closedLate'));
    expect(sum('closedLateFlagged')).toBeGreaterThan(0);
    expect(sum('closedLateMissed')).toBeGreaterThan(0);
  });
});

describe('locked dates (FR-3, FR-14, FR-15)', () => {
  it('rejects any update to first_due_on in the database', async () => {
    await expect(db.query(`UPDATE tasks SET first_due_on = '2030-01-01' WHERE id = 'tsk_001'`)).rejects.toThrow(/locked/);
  });

  it('keeps events append-only', async () => {
    await expect(db.query(`DELETE FROM events WHERE entity_id = 'tsk_001'`)).rejects.toThrow(/append-only/);
    await expect(db.query(`UPDATE events SET reason = 'x' WHERE entity_id = 'tsk_001'`)).rejects.toThrow(/append-only/);
  });

  it('creates with first date equal to due date', async () => {
    const t = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Test task', ownerId: 'per_bo', dueOn: '2026-10-20' });
    expect([t.firstDueOn, t.dueOn, t.health]).toEqual(['2026-10-20', '2026-10-20', 'not_started']);
    expect(await code(s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Past', ownerId: 'per_bo', dueOn: '2026-10-01' }))).toBe('400 date_in_past');
    expect(await code(s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Nobody', ownerId: 'per_zz', dueOn: '2026-10-20' }))).toBe('400 owner_not_on_roster');
  });

  it('needs a reason to renegotiate, and keeps the first date', async () => {
    const t = await openAppTask();
    expect(await code(s.renegotiate(db, t.ownerId, t.id, { version: t.version, newDueOn: '2026-10-30', reason: ' ' }))).toBe('400 reason_required');
    const r = await s.renegotiate(db, t.ownerId, t.id, { version: t.version, newDueOn: '2026-10-30', reason: 'Waiting on supplier quotes.' });
    expect(r.dueOn).toBe('2026-10-30');
    expect(r.firstDueOn).toBe(t.firstDueOn);
    const log = await s.taskLog(db, t.id);
    expect(log[0]).toMatchObject({ field: 'due_on', after: '2026-10-30', reason: 'Waiting on supplier quotes.' });
  });

  it('refuses a stale version', async () => {
    const t = await openAppTask();
    expect(await code(s.setHealth(db, t.ownerId, t.id, { version: t.version + 1, health: 'on_track' }))).toBe('409 version_conflict');
  });
});

describe('picked status (team decision, 9 Oct, replacing the Red rule)', () => {
  it('takes only not started or in progress; ahead and at risk are worked out, not picked', async () => {
    const t = (await s.teamTasks(db, TEAM_ID, AS_OF)).find((x) => x.statusCategory === 'open' && x.origin === 'app' && x.health === 'not_started' && !x.blocked)!;
    expect(await code(s.setHealth(db, t.ownerId, t.id, { version: t.version, health: 'off_track', reason: 'Printer is closed this week.' }))).toBe('400 invalid_body');
    expect(await code(s.setHealth(db, t.ownerId, t.id, { version: t.version, health: 'ahead', reason: 'Printer is closed this week.' }))).toBe('400 invalid_body');
    const r = await s.setHealth(db, t.ownerId, t.id, { version: t.version, health: 'on_track' });
    expect([r.health, r.dueOn]).toEqual(['on_track', t.dueOn]);
    expect(await code(s.setHealth(db, t.ownerId, t.id, { version: r.version, health: 'not_started' }))).toBe('400 reason_required');
    const back = await s.setHealth(db, t.ownerId, t.id, { version: r.version, health: 'not_started', reason: 'Paused until the brief is signed.' });
    expect(back.health).toBe('not_started');
    expect((await s.taskLog(db, t.id, undefined, 1))[0]).toMatchObject({ field: 'health', reason: 'Paused until the brief is signed.' });
  });
});

describe('silent slips (FR-17, FR-18)', () => {
  it('marks an overdue task, and keeps the mark after a late renegotiation', async () => {
    const overdue = (await s.teamTasks(db, TEAM_ID, AS_OF)).find((t) => t.overdue && t.origin === 'app')!;
    expect(overdue.slippedSilently).toBe(true);
    const r = await s.renegotiate(db, overdue.ownerId, overdue.id, { version: overdue.version, newDueOn: '2026-10-14', reason: 'Picked back up after the review.' });
    expect(r.overdue).toBe(false);
    expect(r.renegotiations.at(-1)!.kind).toBe('late');
    expect(r.slippedSilently).toBe(true);
  });
});

describe('roles and mirrors', () => {
  it('lets only a lead set priority (FR-27)', async () => {
    const t = await openAppTask();
    expect(await code(s.setPriority(db, t.ownerId, t.id, { version: t.version, value: 'high' }))).toBe('403 not_allowed');
    const r = await s.setPriority(db, LEAD, t.id, { version: t.version, value: 'high' });
    expect(r.priority).toMatchObject({ value: 'high', setBy: LEAD });
  });

  it('refuses a member editing another person’s task (FR-5)', async () => {
    const t = await openAppTask();
    const other = ['per_bo', 'per_cy', 'per_dee', 'per_eli'].find((p) => p !== t.ownerId && p !== t.createdBy)!;
    expect(await code(s.editTask(db, other, t.id, { version: t.version, title: 'Hijack' }))).toBe('403 not_allowed');
  });

  it('keeps Sheet mirrors read-only (FR-35)', async () => {
    const m = (await s.teamTasks(db, TEAM_ID, AS_OF)).find((t) => t.origin === 'sheet')!;
    expect(await code(s.setHealth(db, LEAD, m.id, { version: m.version, health: 'on_track' }))).toBe('403 read_only_mirror');
    expect(await code(s.addUpdate(db, LEAD, m.id, 'hello'))).toBe('403 read_only_mirror');
  });

  it('needs a reason to drop, and only a lead reopens (FR-7)', async () => {
    const t = await openAppTask();
    expect(await code(s.closeTask(db, t.ownerId, t.id, { version: t.version, as: 'dropped' }))).toBe('400 reason_required');
    const d = await s.closeTask(db, t.ownerId, t.id, { version: t.version, as: 'done' });
    expect(d.statusCategory).toBe('done');
    expect(await code(s.reopenTask(db, t.ownerId, t.id, { version: d.version, reason: 'Found a mistake in it.' }))).toBe('403 not_allowed');
    const o = await s.reopenTask(db, LEAD, t.id, { version: d.version, reason: 'Found a mistake in it.' });
    expect([o.statusCategory, o.closedAt]).toEqual(['open', null]);
  });

  it('lists finished tasks newest first, dropped ones by when they were dropped', async () => {
    const { latestEndedFirst } = await import('../lib/derive');
    const open = (await s.teamTasks(db, TEAM_ID, AS_OF)).filter((x) => x.statusCategory === 'open' && x.origin === 'app').slice(0, 2);
    const first = await s.closeTask(db, open[0].ownerId, open[0].id, { version: open[0].version, as: 'done' });
    await new Promise((r) => setTimeout(r, 5));
    const second = await s.closeTask(db, open[1].ownerId, open[1].id, { version: open[1].version, as: 'dropped', reason: 'Not needed' });
    expect(second.endedAt).not.toBeNull();
    expect([first, second].sort(latestEndedFirst).map((t) => t.id)).toEqual([second.id, first.id]);
  });

  it('sorts finished lists newest first, oldest first or by due date, with unfinished tasks last', async () => {
    const { sortEnded } = await import('../lib/derive');
    type T = Parameters<typeof sortEnded>[0][number];
    const t = (id: string, endedAt: string | null, dueOn: string, firstDueOn = dueOn) => ({ id, endedAt, dueOn, firstDueOn }) as T;
    const list = [t('a', '2026-10-05T10:00:00.000Z', '2026-10-09'), t('b', null, '2026-10-01'), t('c', '2026-10-07T10:00:00.000Z', '2026-10-02', '2026-10-12')];
    const ids = (by: 'recent' | 'oldest' | 'due', due?: 'dueOn' | 'firstDueOn') => sortEnded(list, by, due).map((x) => x.id).join('');
    expect([ids('recent'), ids('oldest'), ids('due'), ids('due', 'firstDueOn')]).toEqual(['cab', 'acb', 'bca', 'bac']);
  });

  it('lets an admin reopen, since an admin can do what a lead can', async () => {
    const t = await openAppTask();
    const d = await s.closeTask(db, t.ownerId, t.id, { version: t.version, as: 'done' });
    const o = await s.reopenTask(db, ADMIN, t.id, { version: d.version, reason: 'Closed by mistake.' });
    expect(o.statusCategory).toBe('open');
  });
});

describe('blocked asks (FR-23 to FR-25)', () => {
  it('notifies the named person in-app and refuses blocking on the owner', async () => {
    const t = await openAppTask();
    expect(await code(s.blockTask(db, t.ownerId, t.id, { version: t.version, onId: t.ownerId, ask: 'Need the final copy please.' }))).toBe('400 invalid_body');
    const b = await s.blockTask(db, t.ownerId, t.id, { version: t.version, onId: LEAD, ask: 'Need the final copy please.' });
    expect(b.blocked).toMatchObject({ onId: LEAD });
    const n = await s.listNotices(db, LEAD);
    expect(n.some((x) => x.kind === 'blocked_on_you' && x.taskId === t.id)).toBe(true);
    const u = await s.unblockTask(db, LEAD, t.id, { version: b.version, note: 'Sent it over.' });
    expect(u.blocked).toBeNull();
  });
});

describe('reminders (FR-36)', () => {
  it('creates each notice once per day, for owners only', async () => {
    const first = await s.runReminders(db, AS_OF);
    expect(first).toBeGreaterThan(0);
    expect(await s.runReminders(db, AS_OF)).toBe(0);
  });
});

describe('roster (FR-55)', () => {
  it('lets only the admin add people', async () => {
    const input = { displayName: 'Test Person', role: 'Tester', department: 'Digital', email: 'test@example.test', appRoles: [] };
    expect(await code(s.addPerson(db, LEAD, TEAM_ID, input))).toBe('403 not_allowed');
    const p = await s.addPerson(db, ADMIN, TEAM_ID, input);
    expect(p.appRoles).toEqual(['member']);
  });

  it('adds several people at once, skipping emails already on the roster', async () => {
    const row = (n: string) => ({ displayName: `Bulk ${n}`, role: 'Tester', department: 'Digital', email: `Bulk.${n}@example.test` });
    expect(await code(s.addPeople(db, LEAD, TEAM_ID, [row('a')]))).toBe('403 not_allowed');
    expect(await s.addPeople(db, ADMIN, TEAM_ID, [row('a'), row('b'), row('a')])).toEqual({ added: 2, skipped: ['bulk.a@example.test'] });
    expect(await s.addPeople(db, ADMIN, TEAM_ID, [row('b'), row('c')])).toEqual({ added: 1, skipped: ['bulk.b@example.test'] });
    const people = await s.listPeople(db, TEAM_ID);
    expect(people.filter((p) => p.email.startsWith('bulk.')).map((p) => [p.email, p.appRoles])).toEqual([
      ['bulk.a@example.test', ['member']], ['bulk.b@example.test', ['member']], ['bulk.c@example.test', ['member']],
    ]);
  });
});
