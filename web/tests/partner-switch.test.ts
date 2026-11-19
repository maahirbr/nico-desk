import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { getProject, projectMembers, updateProject, type ProjectInput } from '../lib/plan';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// A task board can take a partner after it is made, and go back to internal (19 Nov, the PM's call).
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? e.code : (() => { throw e; })()));

async function input(id: string, partnerName: string, partnerPeople: string[] = []): Promise<ProjectInput> {
  const p = await getProject(db, id);
  const members = (await projectMembers(db, id)).map((m) => ({ personId: m.personId, role: m.role }));
  return { name: p.name, kind: p.kind, ownerId: p.ownerId, leadId: p.leadId, goal: p.intro ?? '', launchOn: p.launchOn, targetLabel: p.targetLabel ?? undefined,
    workstreams: p.workstreams, members, partnerName, partnerPeople };
}

describe('switching a task board between internal and partner', () => {
  it('adds a partner, then removes it', async () => {
    const { rows: [pr] } = await db.query<{ id: string; owner_id: string }>(
      `SELECT id, owner_id FROM projects WHERE team_id = $1 AND kind = 'tasks' AND partner_name IS NULL AND archived_at IS NULL AND personal_for IS NULL ORDER BY id LIMIT 1`, [TEAM_ID]);
    await updateProject(db, pr.owner_id, pr.id, await input(pr.id, 'TheCRUX', ['Asha']));
    expect((await getProject(db, pr.id)).partnerName).toBe('TheCRUX');
    await updateProject(db, pr.owner_id, pr.id, await input(pr.id, ''));
    expect((await getProject(db, pr.id)).partnerName).toBeNull();
    // The project's log keeps who the partner was.
    const { rows } = await db.query<{ before: unknown; after: unknown }>(`SELECT before, after FROM events WHERE entity_type = 'project' AND entity_id = $1 AND field = 'partner_name' ORDER BY at`, [pr.id]);
    expect(rows.map((r) => [r.before, r.after])).toEqual([[null, 'TheCRUX'], ['TheCRUX', null]]);
  });
  it('keeps the partner person on a finished task after the project goes internal', async () => {
    const { rows: [pr] } = await db.query<{ id: string; owner_id: string }>(
      `SELECT id, owner_id FROM projects WHERE team_id = $1 AND kind = 'tasks' AND partner_name IS NULL AND archived_at IS NULL AND personal_for IS NULL ORDER BY id LIMIT 1`, [TEAM_ID]);
    await updateProject(db, pr.owner_id, pr.id, await input(pr.id, 'TheCRUX', ['Asha']));
    const t = await s.createTask(db, pr.owner_id, { teamId: TEAM_ID, title: 'Shoot the lookbook', ownerId: pr.owner_id, partnerOwner: 'Asha', dueOn: '2026-10-20', projectId: pr.id } as never);
    await s.closeTask(db, pr.owner_id, t.id, { version: t.version, as: 'done' });
    await updateProject(db, pr.owner_id, pr.id, await input(pr.id, ''));
    expect((await s.getTask(db, t.id)).partnerOwner).toBe('Asha');
  });
  it('will not go back to internal while a task is owned only by the partner', async () => {
    const { rows: [pr] } = await db.query<{ id: string; owner_id: string }>(
      `SELECT id, owner_id FROM projects WHERE team_id = $1 AND kind = 'tasks' AND partner_name IS NULL AND archived_at IS NULL AND personal_for IS NULL ORDER BY id LIMIT 1`, [TEAM_ID]);
    await updateProject(db, pr.owner_id, pr.id, await input(pr.id, 'TheCRUX', ['Asha']));
    await s.createTask(db, pr.owner_id, { teamId: TEAM_ID, title: 'Partner sends the samples', ownerId: null, partnerOwner: 'Asha', dueOn: '2026-10-20', projectId: pr.id } as never);
    expect(await code(updateProject(db, pr.owner_id, pr.id, await input(pr.id, '')))).toBe('invalid_body');
    expect((await getProject(db, pr.id)).partnerName).toBe('TheCRUX');
  });
});
