import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { createProject } from '../lib/plan';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// Removing someone from NicoDesk (3 Nov): admins only, never yourself; what they hold goes to one person in the same
// step; nothing they did is deleted; Bring back undoes it.
const ADMIN = 'per_fay', LEAD = 'per_ada', LEAVER = 'per_bo', TAKER = 'per_cy';
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status} ${e.code}` : (() => { throw e; })()));
const person = async (id: string) => (await s.listPeople(db, TEAM_ID)).find((p) => p.id === id)!;

describe('removing a person', () => {
  it('needs a hand-off for open work, then moves it all and keeps the history', async () => {
    const t = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Print hamper labels', ownerId: LEAVER, dueOn: '2026-10-20' });
    const waiting = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Sign off the box art', ownerId: LEAD, dueOn: '2026-10-21' });
    await s.blockTask(db, LEAD, waiting.id, { version: waiting.version, onId: LEAVER, ask: 'Needs the final art' });
    const p = await createProject(db, LEAD, TEAM_ID, { name: 'Gift wrap trial', kind: 'tasks', ownerId: LEAVER, goal: 'Try three wraps', workstreams: [], members: [] });
    const load = await s.handoffLoad(db, ADMIN, TEAM_ID, LEAVER);
    expect(load.tasks.map((x) => x.title)).toContain('Print hamper labels');
    expect(load.projects).toEqual([{ id: p.id, name: 'Gift wrap trial', as: 'owner' }]);
    expect(load.waitingOn.map((x) => x.title)).toEqual(['Sign off the box art']);

    expect(await code(s.removePerson(db, ADMIN, TEAM_ID, LEAVER, null, 'Left Nicobar'))).toBe('400 needs_handoff');
    expect(await code(s.removePerson(db, ADMIN, TEAM_ID, LEAVER, LEAVER, 'Left Nicobar'))).toBe('400 invalid_body');
    await s.removePerson(db, ADMIN, TEAM_ID, LEAVER, TAKER, 'Left Nicobar');

    expect((await person(LEAVER)).active).toBe(false);
    expect((await s.getTask(db, t.id)).ownerId).toBe(TAKER);
    expect((await s.getTask(db, waiting.id)).blocked?.onId).toBe(TAKER);
    const { rows: [proj] } = await db.query<{ owner_id: string }>(`SELECT owner_id FROM projects WHERE id = $1`, [p.id]);
    expect(proj.owner_id).toBe(TAKER);
    const { rows: log } = await db.query<{ actor_id: string; reason: string }>(`SELECT actor_id, reason FROM events WHERE entity_id = $1 AND field = 'owner_id'`, [t.id]);
    expect(log[0]).toMatchObject({ actor_id: ADMIN, reason: 'Handed over when the owner left NicoDesk' });
    expect(await s.handoffLoad(db, ADMIN, TEAM_ID, LEAVER)).toEqual({ tasks: [], projects: [], waitingOn: [] });
    // Their own history is untouched: the task they were given still says so.
    const { rows: made } = await db.query(`SELECT 1 FROM events WHERE entity_id = $1 AND field = '_created'`, [t.id]);
    expect(made).toHaveLength(1);

    // The reason is kept for admins, and each handed-over item waits on the new holder's Home.
    const { rows: [rec] } = await db.query<{ removed_reason: string; removed_by: string }>(`SELECT removed_reason, removed_by FROM people WHERE id = $1`, [LEAVER]);
    expect(rec).toEqual({ removed_reason: 'Left Nicobar', removed_by: ADMIN });
    const items = await s.handoversForMe(db, TAKER, TEAM_ID);
    expect([...new Set(items.map((i) => i.kind))].sort()).toEqual(['block', 'project', 'task']); // plus their other open tasks
    expect(items.every((i) => i.fromId === LEAVER)).toBe(true);
    // Pass the task on, keep the rest: each leaves the card.
    const task = items.find((i) => i.kind === 'task' && i.refId === t.id)!;
    await s.settleHandover(db, TAKER, TEAM_ID, task.id, LEAD);
    expect((await s.getTask(db, t.id)).ownerId).toBe(LEAD);
    for (const i of items.filter((x) => x.id !== task.id)) await s.settleHandover(db, TAKER, TEAM_ID, i.id, null);
    expect(await s.handoversForMe(db, TAKER, TEAM_ID)).toEqual([]);
    expect(await code(s.settleHandover(db, LEAD, TEAM_ID, task.id, null))).toBe('404 not_found'); // not theirs

    // Off every project they were on, and out of the Ledger.
    const { rows: still } = await db.query(`SELECT 1 FROM project_members WHERE person_id = $1`, [LEAVER]);
    expect(still).toEqual([]);
    const admin = (await s.listPeople(db, TEAM_ID)).find((x) => x.id === ADMIN)!;
    const { ledgerFor } = await import('../lib/visibility');
    const l = await ledgerFor(db, { person: admin, realPerson: admin, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } },
      { from: '2026-09-01', to: '2026-10-31', prevFrom: '2026-08-01', prevTo: '2026-08-31' });
    expect(l.rows.some((r) => r.personId === LEAVER)).toBe(false);

    await s.patchPerson(db, ADMIN, TEAM_ID, LEAVER, { active: true }); // Bring back
    expect((await person(LEAVER)).active).toBe(true);
  });

  it('needs a reason', async () => {
    expect(await code(s.removePerson(db, ADMIN, TEAM_ID, LEAVER, TAKER, ' '))).toBe('400 invalid_body');
  });

  it('is for admins only, never yourself, and only to an active teammate', async () => {
    expect(await code(s.handoffLoad(db, LEAD, TEAM_ID, LEAVER))).toBe('403 not_allowed');
    expect(await code(s.removePerson(db, LEAD, TEAM_ID, LEAVER, TAKER, 'Left Nicobar'))).toBe('403 not_allowed');
    expect(await code(s.removePerson(db, ADMIN, TEAM_ID, ADMIN, TAKER, 'Left Nicobar'))).toBe('400 invalid_body');
    await s.patchPerson(db, ADMIN, TEAM_ID, TAKER, { active: false });
    expect(await code(s.removePerson(db, ADMIN, TEAM_ID, LEAVER, TAKER, 'Left Nicobar'))).toBe('400 owner_not_on_roster');
  });
});
