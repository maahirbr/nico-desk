import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// A person's page: who may open it, what it shows (and what it holds back), and the address of an open task.

import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { workingWith } from '../lib/sight';
import { TASK_PARAM, withTask } from '../components/taskUrl';

const AS_OF = '2026-10-09';
const LEAD = 'per_ada';
const ADMIN = 'per_fay';
let db: Db;

beforeAll(() => { process.env.NICO_TODAY = AS_OF; });
beforeEach(async () => { db = await openDb(); });

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { if (e instanceof ApiError) return `${e.status} ${e.code}`; throw e; }
  return 'ok';
}

async function plainMembers() {
  const people = await s.listPeople(db, TEAM_ID);
  return people.filter((p) => p.active && p.appRoles.length === 1 && p.appRoles[0] === 'member');
}

describe('personView', () => {
  it('refuses someone who is not on the team', async () => {
    expect(await code(s.personView(db, TEAM_ID, LEAD, 'per_nobody', AS_OF))).toBe('404 not_found');
    await db.query(`INSERT INTO people (id, display_name, role, department, email) VALUES ('per_outside', 'Outside Person', 'Tester', 'Other', 'outside@example.test')`);
    expect(await code(s.personView(db, TEAM_ID, LEAD, 'per_outside', AS_OF))).toBe('404 not_found');
  });

  it('lists a person\'s open tasks, their projects, and nothing owned by others', async () => {
    const tasks = await s.teamTasks(db, TEAM_ID, AS_OF);
    const owner = tasks.find((t) => t.statusCategory === 'open')!.ownerId;
    const v = await s.personView(db, TEAM_ID, ADMIN, owner, AS_OF); // only an admin sees every task (15 Oct)
    expect(v.person.id).toBe(owner);
    expect(v.open.length).toBe(tasks.filter((t) => t.statusCategory === 'open' && t.ownerId === owner).length);
    expect(v.open.every((t) => t.ownerId === owner && t.statusCategory === 'open')).toBe(true);
    const dues = v.open.map((t) => t.dueOn);
    expect([...dues].sort()).toEqual(dues);
    expect(v.recent.every((e) => e.taskTitle.length > 0)).toBe(true);
  });

  it('puts a blocked task on both sides: waiting on them, and waiting on others', async () => {
    const members = await plainMembers();
    const [a, b] = members;
    const tasks = await s.teamTasks(db, TEAM_ID, AS_OF);
    const t = tasks.find((x) => x.origin === 'app' && x.statusCategory === 'open' && x.ownerId === a.id && !x.blocked)!;
    expect(t).toBeTruthy();
    await s.blockTask(db, a.id, t.id, { version: t.version, onId: b.id, ask: 'Need the final copy please.' });
    const onB = await s.personView(db, TEAM_ID, a.id, b.id, AS_OF);
    expect(onB.waitingOnThem.map((x) => x.id)).toContain(t.id);
    expect(onB.waitingOnOthers.map((x) => x.id)).not.toContain(t.id);
    const onA = await s.personView(db, TEAM_ID, a.id, a.id, AS_OF);
    expect(onA.waitingOnOthers.map((x) => x.id)).toContain(t.id);
    expect(onA.waitingOnThem.map((x) => x.id)).not.toContain(t.id);
  });

  it('shows the on-time record to a lead, an admin, the person and the people they work with, and to no other member', async () => {
    const members = await plainMembers();
    const a = members[0];
    const near = await workingWith(db, TEAM_ID, a.id);
    const b = members.find((m) => m.id !== a.id && !near.has(m.id))!;
    const c = members.find((m) => m.id !== a.id && near.has(m.id))!;
    expect(b && c).toBeTruthy();
    expect((await s.personView(db, TEAM_ID, LEAD, a.id, AS_OF)).record).not.toBeNull();
    expect((await s.personView(db, TEAM_ID, a.id, a.id, AS_OF)).record).not.toBeNull();
    expect((await s.personView(db, TEAM_ID, c.id, a.id, AS_OF)).record).not.toBeNull();
    expect((await s.personView(db, TEAM_ID, b.id, a.id, AS_OF)).record).toBeNull();
    const admin = (await s.listPeople(db, TEAM_ID)).find((p) => p.appRoles.includes('admin'))!;
    expect((await s.personView(db, TEAM_ID, admin.id, a.id, AS_OF)).record).not.toBeNull();
  });

  it('adds up the same closed outcomes the ledger counts', async () => {
    const [a] = await plainMembers();
    const v = await s.personView(db, TEAM_ID, LEAD, a.id, AS_OF);
    const rows = await s.ledger(db, TEAM_ID, v.record!.from, v.record!.to, a.id, AS_OF);
    expect(v.record!.late).toBe(rows.reduce((n, r) => n + r.closedLate, 0));
    expect(v.record!.onTime).toBe(rows.reduce((n, r) => n + r.closedOnTime, 0));
  });
});

describe('the task address', () => {
  it('sets, replaces and clears ?task= and keeps other parts', () => {
    expect(TASK_PARAM).toBe('task');
    expect(withTask('', 'tsk_1')).toBe('?task=tsk_1');
    expect(withTask('?who=per_a', 'tsk_1')).toBe('?who=per_a&task=tsk_1');
    expect(withTask('?task=tsk_1&who=per_a', 'tsk_2')).toBe('?task=tsk_2&who=per_a');
    expect(withTask('?task=tsk_1', null)).toBe('');
    expect(withTask('?task=tsk_1&who=per_a', null)).toBe('?who=per_a');
  });
});

describe('findPersonByEmail', () => {
  it('finds a person by any of their sign-in addresses, in any case', async () => {
    await db.query(`UPDATE people SET alt_emails = ARRAY['ada@partner.example'] WHERE id = $1`, [LEAD]);
    const { rows } = await db.query<{ email: string }>(`SELECT email FROM people WHERE id = $1`, [LEAD]);
    expect((await s.findPersonByEmail(db, rows[0].email))?.id).toBe(LEAD);
    expect((await s.findPersonByEmail(db, 'Ada@Partner.example'))?.id).toBe(LEAD);
    expect(await s.findPersonByEmail(db, 'someone@partner.example')).toBeNull();
  });
});
