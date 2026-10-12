import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Undo: the pure rules (what has a clean inverse, what steps put it back) and a round trip through the
// real service rules, so an undo is proved to be an ordinary change that the same checks accept.

import { openDb, type Db } from '../lib/db';
import type { Task } from '../lib/derive';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { canUndo, editFields, planUndo, statusFields, UNDO_REASON, type UndoField, type UndoStep } from '../lib/undo';

const AS_OF = '2026-10-09';
let db: Db;

beforeAll(() => { process.env.NICO_TODAY = AS_OF; });
beforeEach(async () => { db = await openDb(); });

const snap = (o: Partial<Task> = {}): Task => ({
  id: 't', statusCategory: 'open', blocked: null, health: 'on_track', dueOn: '2026-10-20', ownerId: 'me', title: 'A', description: '', note: '', workstream: null,
  readOnly: false, version: 1, ...o,
}) as unknown as Task;
const me = { meId: 'me', isLead: false };
const lead = { meId: 'boss', isLead: true };

describe('which changes have an Undo', () => {
  it('offers none on a read-only task or with no touched field', () => {
    expect(canUndo(snap({ readOnly: true }), ['health'], me, AS_OF)).toBe(false);
    expect(canUndo(snap(), [], me, AS_OF)).toBe(false);
  });
  it('lets only a lead or admin undo a close, since that is a reopen', () => {
    expect(canUndo(snap(), ['category', 'blocked'], me, AS_OF)).toBe(false);
    expect(canUndo(snap(), ['category', 'blocked'], lead, AS_OF)).toBe(true);
  });
  it('lets a plain owner undo a reopen, which is a close', () => {
    expect(canUndo(snap({ statusCategory: 'done' }), ['category'], me, AS_OF)).toBe(true);
  });
  it('offers none for a stored health that cannot be set again, or a past date', () => {
    expect(canUndo(snap({ health: 'off_track' }), ['health'], me, AS_OF)).toBe(false);
    expect(canUndo(snap({ health: 'not_started' } as Partial<Task>), ['health'], me, AS_OF)).toBe(true);
    expect(canUndo(snap({ dueOn: '2026-10-01' }), ['due'], me, AS_OF)).toBe(false);
    expect(canUndo(snap({ dueOn: AS_OF }), ['due'], me, AS_OF)).toBe(true);
  });
  it('lets only owner or lead put a block back, and only a lead hand a task back', () => {
    const blocked = { onId: null, ask: 'Waiting on a vendor', since: AS_OF } as unknown as Task['blocked'];
    expect(canUndo(snap({ blocked, ownerId: 'other' }), ['blocked'], me, AS_OF)).toBe(false);
    expect(canUndo(snap({ blocked }), ['blocked'], me, AS_OF)).toBe(true);
    expect(canUndo(snap({ blocked, ownerId: 'other' }), ['blocked'], lead, AS_OF)).toBe(true);
    expect(canUndo(snap(), ['owner'], me, AS_OF)).toBe(false);
    expect(canUndo(snap(), ['owner'], lead, AS_OF)).toBe(true);
  });
});

describe('planUndo steps', () => {
  it('reopens a task that was open before and is closed now', () => {
    const steps = planUndo(snap(), snap({ statusCategory: 'done' }), ['category', 'blocked']);
    expect(steps).toEqual([{ path: '/reopen', method: 'POST', body: { reason: UNDO_REASON } }]);
  });
  it('closes again as the same kind, and stops there', () => {
    const steps = planUndo(snap({ statusCategory: 'dropped' }), snap({ statusCategory: 'open', dueOn: '2026-10-30' }), ['category', 'due']);
    expect(steps).toEqual([{ path: '/close', method: 'POST', body: { as: 'dropped', reason: UNDO_REASON } }]);
  });
  it('does nothing when the task is already as it was', () => {
    expect(planUndo(snap(), snap(), ['category', 'health', 'due', 'blocked'])).toEqual([]);
  });
  it('puts only the touched fields back, so another person\'s change to a field it did not touch stays', () => {
    const steps = planUndo(snap({ dueOn: '2026-10-20' }), snap({ dueOn: '2026-10-25', title: 'Renamed by someone else' }), ['due']);
    expect(steps).toEqual([{ path: '/renegotiate', method: 'POST', body: { newDueOn: '2026-10-20', reason: UNDO_REASON } }]);
  });
  it('sends a reason when going back to not started', () => {
    const steps = planUndo(snap({ health: 'not_started' } as Partial<Task>), snap({ health: 'on_track' }), ['health']);
    expect(steps).toEqual([{ path: '/health', method: 'POST', body: { health: 'not_started', reason: UNDO_REASON } }]);
  });
  it('unblocks, or blocks again with the same words', () => {
    const blocked = { onId: 'x', ask: 'Need the file', since: AS_OF } as unknown as Task['blocked'];
    expect(planUndo(snap(), snap({ blocked }), ['blocked'])).toEqual([{ path: '/unblock', method: 'POST', body: {} }]);
    expect(planUndo(snap({ blocked }), snap(), ['blocked'])).toEqual([{ path: '/block', method: 'POST', body: { onId: 'x', ask: 'Need the file' } }]);
  });
  it('joins edited text fields and owner into one PATCH', () => {
    const steps = planUndo(snap({ title: 'A', ownerId: 'me' }), snap({ title: 'B', ownerId: 'you' }), ['title', 'owner']);
    expect(steps).toEqual([{ path: '', method: 'PATCH', body: { title: 'A', ownerId: 'me' } }]);
  });
});

describe('field lists', () => {
  it('names what each status move touches', () => {
    expect(statusFields({ blocked: null }, 'done')).toEqual(['category', 'blocked']);
    expect(statusFields({ blocked: null }, 'blocked')).toEqual(['blocked']);
    expect(statusFields({ blocked: null }, 'doing')).toEqual(['health']);
    expect(statusFields({ blocked: { ask: 'x' } as unknown as Task['blocked'] }, 'todo')).toEqual(['blocked', 'health']);
  });
  it('maps an edit body to fields', () => {
    expect(editFields({ title: 'x', ownerId: 'y', version: 2 })).toEqual(['title', 'owner']);
  });
});

// Run the steps the way the API routes do, as the same person, through the service.
async function apply(meId: string, id: string, version: number, steps: UndoStep[]) {
  let v = version;
  for (const st of steps) {
    const b = { version: v, ...st.body } as never;
    let t: Task;
    if (st.path === '/reopen') t = await s.reopenTask(db, meId, id, b);
    else if (st.path === '/close') t = await s.closeTask(db, meId, id, b);
    else if (st.path === '/health') t = await s.setHealth(db, meId, id, b);
    else if (st.path === '/renegotiate') t = await s.renegotiate(db, meId, id, b);
    else if (st.path === '/block') t = await s.blockTask(db, meId, id, b);
    else if (st.path === '/unblock') t = await s.unblockTask(db, meId, id, b);
    else t = await s.editTask(db, meId, id, b);
    v = t.version;
  }
}

async function pick() {
  const tasks = await s.teamTasks(db, TEAM_ID, AS_OF);
  const people = await s.listPeople(db, TEAM_ID);
  const leadId = people.find((p) => p.active && p.appRoles.includes('lead'))!.id;
  const t = tasks.find((x) => x.origin === 'app' && x.statusCategory === 'open' && !x.blocked && x.dueOn >= AS_OF && (x.health === 'on_track' || x.health === 'not_started') && x.ownerId !== leadId)!;
  return { t, leadId, ownerId: t.ownerId };
}

describe('undo through the real rules', () => {
  it('a lead undoes a Done: the task is open again and the log only grew', async () => {
    const { t, leadId } = await pick();
    const before = await s.getTask(db, t.id, AS_OF);
    const logBefore = (await s.taskLog(db, t.id)).length;
    const closed = await s.closeTask(db, leadId, t.id, { version: before.version, as: 'done' });
    expect(canUndo(before, statusFields(before, 'done'), { meId: leadId, isLead: true }, AS_OF)).toBe(true);
    await apply(leadId, t.id, closed.version, planUndo(before, closed, statusFields(before, 'done')));
    const after = await s.getTask(db, t.id, AS_OF);
    expect(after.statusCategory).toBe('open');
    expect((await s.taskLog(db, t.id)).length).toBeGreaterThan(logBefore + 1);
  });

  it('an owner undoes a date move, and the reason is Undone', async () => {
    const { t, ownerId } = await pick();
    const before = await s.getTask(db, t.id, AS_OF);
    const moved = await s.renegotiate(db, ownerId, t.id, { version: before.version, newDueOn: '2026-12-01', reason: 'Vendor is late' });
    expect(canUndo(before, ['due'], { meId: ownerId, isLead: false }, AS_OF)).toBe(true);
    await apply(ownerId, t.id, moved.version, planUndo(before, moved, ['due']));
    const after = await s.getTask(db, t.id, AS_OF);
    expect(after.dueOn).toBe(before.dueOn);
    expect(JSON.stringify(await s.taskLog(db, t.id))).toContain(UNDO_REASON);
  });

  it('an owner undoes a Blocked with an unblock, then a cleared block with a block', async () => {
    const { t, ownerId } = await pick();
    const before = await s.getTask(db, t.id, AS_OF);
    const b = await s.blockTask(db, ownerId, t.id, { version: before.version, ask: 'Waiting on a sample' });
    const fields: UndoField[] = statusFields(before, 'blocked');
    await apply(ownerId, t.id, b.version, planUndo(before, b, fields));
    expect((await s.getTask(db, t.id, AS_OF)).blocked).toBeNull();

    const ub = await s.getTask(db, t.id, AS_OF);
    const blocked = await s.blockTask(db, ownerId, t.id, { version: ub.version, ask: 'Waiting on a sample' });
    const cleared = await s.unblockTask(db, ownerId, t.id, { version: blocked.version, resume: true });
    await apply(ownerId, t.id, cleared.version, planUndo(blocked, cleared, ['blocked', 'health']));
    expect((await s.getTask(db, t.id, AS_OF)).blocked?.ask).toBe('Waiting on a sample');
  });

  it('a plain owner who marks done gets no Undo, since a reopen is lead-only', async () => {
    const { t, ownerId } = await pick();
    const before = await s.getTask(db, t.id, AS_OF);
    expect(canUndo(before, statusFields(before, 'done'), { meId: ownerId, isLead: false }, AS_OF)).toBe(false);
    const closed = await s.closeTask(db, ownerId, t.id, { version: before.version, as: 'done' });
    await expect(apply(ownerId, t.id, closed.version, planUndo(before, closed, ['category']))).rejects.toThrow();
  });
});
