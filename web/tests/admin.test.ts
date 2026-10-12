import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { isLeadOrAdmin } from '../lib/roles';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { canMoveTo } from '../components/statusRules';

// An admin without the lead role does everything a lead does on a task, except block it.
const ADMIN = 'per_fay'; // fixtures: admin only, not a lead
const AS_OF = '2026-10-09';
let db: Db;

beforeAll(() => { process.env.NICO_TODAY = AS_OF; });
beforeEach(async () => { db = await openDb(); });

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { if (e instanceof ApiError) return `${e.status} ${e.code}`; throw e; }
  return 'ok';
}

// An open app task owned by someone who is not the admin.
async function task() {
  const all = await s.teamTasks(db, TEAM_ID, AS_OF);
  const t = all.find((x) => x.statusCategory === 'open' && x.origin === 'app' && x.ownerId !== ADMIN && !x.blocked);
  if (!t) throw new Error('fixture has no open app task');
  return t;
}
async function otherMember(ownerId: string) {
  const people = await s.listPeople(db, TEAM_ID);
  const m = people.find((p) => p.active && p.id !== ownerId && p.id !== ADMIN && p.appRoles.length === 1 && p.appRoles[0] === 'member');
  if (!m) throw new Error('fixture has no plain member');
  return m.id;
}

describe('isLeadOrAdmin', () => {
  it('is true for lead or admin, false for member only', () => {
    expect(isLeadOrAdmin(['member', 'admin'])).toBe(true);
    expect(isLeadOrAdmin(new Set(['member', 'lead']))).toBe(true);
    expect(isLeadOrAdmin(['member'])).toBe(false);
    expect(isLeadOrAdmin([])).toBe(false);
  });
});

describe('admin acts as a lead on another person’s task', () => {
  it('has no lead role in the fixtures', async () => {
    const p = (await s.listPeople(db, TEAM_ID)).find((x) => x.id === ADMIN)!;
    expect(p.appRoles).toContain('admin');
    expect(p.appRoles).not.toContain('lead');
  });

  it('edits, reassigns, moves the date, sets priority and posts an update', async () => {
    const t = await task();
    const to = await otherMember(t.ownerId);
    let cur = await s.editTask(db, ADMIN, t.id, { version: t.version, title: 'Renamed by the admin' });
    expect(cur.title).toBe('Renamed by the admin');
    cur = await s.editTask(db, ADMIN, t.id, { version: cur.version, ownerId: to });
    expect(cur.ownerId).toBe(to);
    cur = await s.renegotiate(db, ADMIN, t.id, { version: cur.version, newDueOn: '2026-12-31', reason: 'Supplier is late again' });
    expect(cur.dueOn).toBe('2026-12-31');
    cur = await s.setPriority(db, ADMIN, t.id, { version: cur.version, value: 'high' });
    expect(cur.priority?.value).toBe('high');
    expect(await code(s.addUpdate(db, ADMIN, t.id, 'Checked in with the owner'))).toBe('ok');
  });

  it('closes and reopens a task', async () => {
    const t = await task();
    const done = await s.closeTask(db, ADMIN, t.id, { version: t.version, as: 'done' });
    expect(done.statusCategory).toBe('done');
    const back = await s.reopenTask(db, ADMIN, t.id, { version: done.version, reason: 'Reopened after review' });
    expect(back.statusCategory).toBe('open');
  });

  it('still cannot block someone else’s task (owner-only)', async () => {
    const t = await task();
    expect(await code(s.blockTask(db, ADMIN, t.id, { version: t.version, ask: 'Waiting on the supplier to confirm' }))).toBe('403 not_allowed');
  });
});

describe('a plain member still cannot', () => {
  it('edit, move, close, prioritise, update or reopen another person’s task', async () => {
    const t = await task();
    const m = await otherMember(t.ownerId);
    expect(await code(s.editTask(db, m, t.id, { version: t.version, title: 'Sneaky rename' }))).toBe('403 not_allowed');
    expect(await code(s.renegotiate(db, m, t.id, { version: t.version, newDueOn: '2026-12-31', reason: 'Because I said so' }))).toBe('403 not_allowed');
    expect(await code(s.closeTask(db, m, t.id, { version: t.version, as: 'done' }))).toBe('403 not_allowed');
    expect(await code(s.setPriority(db, m, t.id, { version: t.version, value: 'high' }))).toBe('403 not_allowed');
    expect(await code(s.addUpdate(db, m, t.id, 'Hello'))).toBe('403 not_allowed');
    const done = await s.closeTask(db, ADMIN, t.id, { version: t.version, as: 'done' });
    expect(await code(s.reopenTask(db, m, t.id, { version: done.version, reason: 'Trying to reopen it' }))).toBe('403 not_allowed');
  });
});

describe('status controls match the service', () => {
  const t = { ownerId: 'o', readOnly: false, statusCategory: 'open' as const };
  it('blocked is owner-only, other moves are owner or lead/admin', () => {
    expect(canMoveTo(t, 'blocked', 'o', false)).toBe(true);
    expect(canMoveTo(t, 'blocked', 'lead', true)).toBe(false);
    expect(canMoveTo(t, 'done', 'lead', true)).toBe(true);
    expect(canMoveTo(t, 'doing', 'o', false)).toBe(true);
    expect(canMoveTo(t, 'done', 'm', false)).toBe(false);
  });
  it('a closed task can only be moved (reopened) by a lead/admin; mirrors are read-only', () => {
    expect(canMoveTo({ ...t, statusCategory: 'done' }, 'doing', 'o', false)).toBe(false);
    expect(canMoveTo({ ...t, statusCategory: 'done' }, 'doing', 'lead', true)).toBe(true);
    expect(canMoveTo({ ...t, readOnly: true }, 'done', 'o', true)).toBe(false);
  });
});
