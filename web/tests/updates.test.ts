import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { ago, buildUpdates, groupUpdates, smallEdit, type UpdateEvent, type UpdateTask } from '../lib/updates';

// "Updates for you": who is told about what, derived from the events table alone.
const NOW = '2026-10-12T10:00:00.000Z';
const names = { ana: 'Ananya Rao', bo: 'Kabir Sethi', lee: 'Meera Iyer', dee: 'Ishaan Bhatt' };
// Task t1 belongs to bo, in a project led by lee.
const tasks: UpdateTask[] = [
  { id: 't1', title: 'Draft copy', ownerId: 'bo', projectId: 'p1', blocked: null },
  { id: 't2', title: 'Order samples', ownerId: 'bo', projectId: 'p1', blocked: { onId: 'dee' } },
];
const leadOf = { p1: 'lee' };
let n = 0;
const ev = (o: Partial<UpdateEvent> & { field: string; actor_id: string | null }): UpdateEvent =>
  ({ id: `e${++n}`, entity_id: 't1', before: null, after: null, reason: null, at: '2026-10-11T08:00:00.000Z', ...o });
const run = (events: UpdateEvent[], viewerId: string, extra: { seenAt?: string } = {}) =>
  buildUpdates({ events, tasks, leadOf, names, viewerId, now: NOW, ...extra });

describe('updates for you, grouped', () => {
  const g = (events: UpdateEvent[], viewerId: string, ts: UpdateTask[] = tasks) =>
    groupUpdates(buildUpdates({ events, tasks: ts, leadOf, names, viewerId, now: NOW }), ts, { p1: 'Gift hampers' }, names, viewerId, '2026-10-12');

  it('puts one line per task under its project, with who did what in order', () => {
    const ts: UpdateTask[] = [{ ...tasks[0], dueOn: '2026-10-12', statusCategory: 'open' }, { id: 't3', title: 'Book the shoot', ownerId: 'bo', projectId: null, blocked: null, dueOn: '2026-10-20', statusCategory: 'open' }];
    const e = [
      ev({ field: '_created', after: { owner_id: 'bo', due_on: '2026-10-10' }, actor_id: 'lee', at: '2026-10-11T01:00:00.000Z' }),
      ev({ field: 'due_on', before: '2026-10-10', after: '2026-10-12', reason: 'samples late', actor_id: 'lee', at: '2026-10-11T02:00:00.000Z' }),
      ev({ field: 'status_category', before: 'open', after: 'done', actor_id: 'ana', entity_id: 't3', at: '2026-10-11T03:00:00.000Z' }),
    ];
    const out = g(e, 'bo', ts);
    expect(out.map((x) => x.name)).toEqual(['Gift hampers', 'No project']);
    expect(out[0].rows).toEqual([expect.objectContaining({
      title: 'Draft copy', summary: 'Meera assigned it to you, due 10 Oct, then moved it to 12 Oct (was 10 Oct), “samples late”', due: { label: 'Due today', tone: 'soon' },
    })]);
    expect(out[1].rows[0].summary).toBe('Ananya marked it done');
  });

  it('leaves out small renames and tidy-ups right after assigning, keeps real renames', () => {
    expect(smallEdit('Approve hamper samples', 'Aprove hamper samples')).toBe(true);
    expect(smallEdit('Define a rota plan TBC 30 Nov', 'Define a rota plan')).toBe(true);
    expect(smallEdit('Draft copy', 'Book the photo shoot')).toBe(false);
    const tidy = [
      ev({ field: '_created', after: { owner_id: 'bo' }, actor_id: 'lee', at: '2026-10-11T01:00:00.000Z' }),
      ev({ field: 'title', before: 'Write the hamper copy', after: 'Draft copy', actor_id: 'lee', at: '2026-10-11T02:00:00.000Z' }),
    ];
    expect(g(tidy, 'bo')[0].rows[0].summary).toBe('Meera assigned it to you');
    const real = [ev({ field: 'title', before: 'Write the hamper copy', after: 'Draft copy', actor_id: 'lee' })];
    expect(g(real, 'bo')[0].rows[0].summary).toBe('Meera renamed it');
  });
});

describe('updates for you (pure)', () => {
  it('never shows a person their own actions', () => {
    const e = [ev({ field: 'due_on', before: '2026-10-14', after: '2026-10-21', reason: 'supplier delay', actor_id: 'bo' })];
    expect(run(e, 'bo')).toEqual([]);
    expect(run(e, 'lee')).toHaveLength(1); // the lead still hears it from the owner
  });

  it('tells the owner when the lead moves their date', () => {
    const [i] = run([ev({ field: 'due_on', before: '2026-10-14', after: '2026-10-21', reason: 'launch moved', actor_id: 'lee' })], 'bo');
    expect(i.kind).toBe('due_moved');
    expect(i.text).toBe('Meera moved your task “Draft copy” from 14 Oct to 21 Oct: launch moved');
    expect(i.taskId).toBe('t1');
  });

  it('leaves a block on you out of updates (it shows under Waiting on you), and tells the owner when you clear it', () => {
    const at = '2026-10-11T09:00:00.000Z';
    const e = [
      ev({ entity_id: 't2', field: 'blocked_ask', after: 'Need the supplier contact', actor_id: 'bo', at }),
      ev({ entity_id: 't2', field: 'blocked_on_id', after: 'dee', actor_id: 'bo', at }),
    ];
    expect(run(e, 'dee')).toEqual([]);
    expect(run(e, 'ana')).toEqual([]);
    const cleared = '2026-10-11T11:00:00.000Z';
    const done = [...e,
      ev({ entity_id: 't2', field: 'blocked_ask', before: 'Need the supplier contact', after: null, reason: 'Sent it on email', actor_id: 'dee', at: cleared }),
      ev({ entity_id: 't2', field: 'blocked_on_id', before: 'dee', after: null, actor_id: 'dee', at: cleared }),
    ];
    const [o] = run(done, 'bo');
    expect(o.kind).toBe('unblocked');
    expect(o.text).toBe('Ishaan cleared the block on your task “Order samples”: Sent it on email');
    expect(run(done, 'lee').map((i) => i.kind)).toEqual(['unblocked', 'blocked']);
    expect(run(done, 'dee')).toEqual([]);
  });

  it('shows the project lead a date move, with the reason or "no reason given"', () => {
    const move = (reason: string | null) => ev({ field: 'due_on', before: '2026-10-14', after: '2026-10-21', reason, actor_id: 'bo' });
    expect(run([move('supplier delay')], 'lee')[0].text).toBe('Kabir moved “Draft copy” from 14 Oct to 21 Oct: supplier delay');
    expect(run([move(null)], 'lee')[0].text).toBe('Kabir moved “Draft copy” from 14 Oct to 21 Oct: no reason given');
    expect(run([move('x')], 'ana')).toEqual([]); // not owner, not lead, not blocked on
  });

  it('shows the lead blocks, drops and owner changes; the owner assignments, done, drops and renames', () => {
    const e = [
      ev({ field: 'blocked_ask', after: 'Waiting on legal', actor_id: 'bo', at: '2026-10-11T01:00:00.000Z' }),
      ev({ field: 'status_category', before: 'open', after: 'dropped', reason: 'Out of scope', actor_id: 'bo', at: '2026-10-11T02:00:00.000Z' }),
      ev({ field: 'owner_id', before: 'ana', after: 'bo', actor_id: 'lee', at: '2026-10-11T03:00:00.000Z' }),
      ev({ field: 'title', before: 'Old', after: 'Draft copy', actor_id: 'lee', at: '2026-10-11T04:00:00.000Z' }),
      ev({ field: 'status_category', before: 'open', after: 'done', actor_id: 'lee', at: '2026-10-11T05:00:00.000Z' }),
    ];
    expect(run(e, 'lee').map((i) => i.kind)).toEqual(['dropped', 'blocked']);
    expect(run(e, 'bo').map((i) => i.kind)).toEqual(['done', 'renamed', 'assigned']);
    expect(run(e, 'ana')).toEqual([]);
    expect(run(e, 'bo').find((i) => i.kind === 'assigned')?.text).toBe('Meera reassigned “Draft copy” to you');
  });

  it('applies the seen cut-off, the 7 day window and newest-first order', () => {
    const e = [
      ev({ field: 'due_on', before: 'a', after: 'b', reason: 'r', actor_id: 'lee', at: '2026-10-09T08:00:00.000Z' }),
      ev({ field: 'due_on', before: '2026-10-14', after: '2026-10-16', reason: 'r', actor_id: 'lee', at: '2026-10-11T08:00:00.000Z' }),
      ev({ field: 'due_on', before: '2026-10-16', after: '2026-10-18', reason: 'r', actor_id: 'lee', at: '2026-10-10T08:00:00.000Z' }),
      ev({ field: 'due_on', before: 'x', after: 'y', reason: 'r', actor_id: 'lee', at: '2026-10-01T08:00:00.000Z' }), // older than 7 days
      ev({ field: 'due_on', before: 'x', after: 'y', reason: 'r', actor_id: 'lee', at: '2026-10-13T08:00:00.000Z' }), // after now
    ];
    expect(run(e, 'bo').map((i) => i.at)).toEqual(['2026-10-11T08:00:00.000Z', '2026-10-10T08:00:00.000Z', '2026-10-09T08:00:00.000Z']);
    expect(run(e, 'bo', { seenAt: '2026-10-10T08:00:00.000Z' }).map((i) => i.at)).toEqual(['2026-10-11T08:00:00.000Z']);
    expect(run(e, 'bo', { seenAt: '2026-10-11T08:00:00.000Z' })).toEqual([]);
  });

  it('words the time since', () => {
    expect(ago('2026-10-12T09:59:30.000Z', NOW)).toBe('just now');
    expect(ago('2026-10-12T09:15:00.000Z', NOW)).toBe('45 min ago');
    expect(ago('2026-10-12T07:00:00.000Z', NOW)).toBe('3 h ago');
    expect(ago('2026-10-11T08:00:00.000Z', NOW)).toBe('yesterday');
    expect(ago('2026-10-08T08:00:00.000Z', NOW)).toBe('4 days ago');
  });
});

describe('updates for you (through the service)', () => {
  let db: Db;
  beforeEach(async () => {
    db = await openDb();
  });
  const LEAD = 'per_ada'; // leads prj_landing
  const OWNER = 'per_bo';
  const WAITED = 'per_dee';

  it('reads real events: date move, block, drop', async () => {
    const people = await s.listPeople(db, TEAM_ID);
    const nm = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
    const t = (await s.teamTasks(db, TEAM_ID)).find((x) => x.statusCategory === 'open' && x.origin === 'app' && x.ownerId === OWNER && x.projectId === 'prj_landing');
    if (!t) throw new Error('fixture has no open per_bo task in prj_landing');
    const moved = await s.renegotiate(db, LEAD, t.id, { version: t.version, newDueOn: '2999-01-01', reason: 'Launch moved' });
    const blocked = await s.blockTask(db, OWNER, t.id, { version: moved.version, onId: WAITED, ask: 'Need the final sizes' });
    await s.closeTask(db, OWNER, t.id, { version: blocked.version, as: 'dropped', reason: 'Not needed now' });

    // Only this task: the fixtures' own events also fall inside the window.
    const mine = async (id: string) => (await s.updatesFor(db, id, TEAM_ID, nm)).filter((i) => i.taskId === t.id);
    expect((await mine(LEAD)).map((i) => i.kind)).toEqual(['dropped', 'blocked']); // not their own date move
    expect((await mine(OWNER)).map((i) => i.kind)).toEqual(['due_moved']);
    const owner = (await mine(OWNER))[0];
    expect(owner.text).toContain('moved your task');
    expect(owner.text).toContain('Launch moved');
    // The block is cleared by the drop, so nothing is left waiting on the third person.
    expect(await mine(WAITED)).toEqual([]);
    // The cut-off hides everything older than it.
    expect(await s.updatesFor(db, OWNER, TEAM_ID, nm, new Date(Date.now() + 1000).toISOString())).toEqual([]);
  });

  it('lets the person waited on clear the block with a note, which the owner then sees', async () => {
    const people = await s.listPeople(db, TEAM_ID);
    const nm = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
    const t = (await s.teamTasks(db, TEAM_ID)).find((x) => x.statusCategory === 'open' && x.origin === 'app' && x.ownerId === OWNER && !x.blocked);
    if (!t) throw new Error('fixture has no open per_bo task');
    const b = await s.blockTask(db, OWNER, t.id, { version: t.version, onId: WAITED, ask: 'Need the final sizes' });
    expect((await s.updatesFor(db, WAITED, TEAM_ID, nm)).filter((x) => x.taskId === t.id)).toEqual([]);
    const cleared = await s.unblockTask(db, WAITED, t.id, { version: b.version, note: 'Sent the sizes' });
    expect(cleared.blocked).toBeNull();
    const [i] = (await s.updatesFor(db, OWNER, TEAM_ID, nm)).filter((x) => x.taskId === t.id);
    expect(i.kind).toBe('unblocked');
    expect(i.text).toContain('Sent the sizes');
  });

  it('keeps seen on the account: all at once, or one task at a time', async () => {
    const people = await s.listPeople(db, TEAM_ID);
    const nm = Object.fromEntries(people.map((p) => [p.id, p.displayName]));
    const t = (await s.teamTasks(db, TEAM_ID)).find((x) => x.statusCategory === 'open' && x.origin === 'app' && x.ownerId === OWNER && !x.blocked);
    if (!t) throw new Error('fixture has no open per_bo task');
    await s.renegotiate(db, LEAD, t.id, { version: t.version, newDueOn: '2999-01-01', reason: 'Launch moved' });
    const view = async () => {
      const m = await s.seenMarks(db, OWNER);
      return (await s.updatesFor(db, OWNER, TEAM_ID, nm, m.all, new Date(), m.byTask)).filter((x) => x.taskId === t.id);
    };
    expect(await view()).toHaveLength(1);
    await s.markUpdatesSeen(db, OWNER, TEAM_ID, { taskIds: [t.id, 'not_a_task'] });
    expect(await view()).toEqual([]);
    expect(Object.keys((await s.seenMarks(db, OWNER)).byTask)).toEqual([t.id]);
    await s.markUpdatesSeen(db, OWNER, TEAM_ID, {});
    expect((await s.seenMarks(db, OWNER)).all).not.toBeNull();
  });
});
