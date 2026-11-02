import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { createProject } from '../lib/plan';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// Partner projects (1 Nov): a task board plus a partner. A task has a Nicobar owner, a partner owner, or both. A task only
// a partner owns shows on its project page, not on Home or Team, and anyone on the project may look after it.
const ME = 'per_ada', MEMBER = 'per_bo';
let db: Db;
beforeAll(() => { process.env.NICO_TODAY = '2026-10-09'; });
beforeEach(async () => { db = await openDb(); });
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status} ${e.code}` : (() => { throw e; })()));
const partnerProject = () => createProject(db, ME, TEAM_ID, {
  name: 'Hamper collab', kind: 'tasks', ownerId: ME, goal: 'A festive hamper with a studio', workstreams: [],
  members: [{ personId: MEMBER, role: 'Production' }], partnerName: 'Studio', partnerPeople: ['Asha', 'Ravi'],
});

describe('partner projects', () => {
  it('are task boards that keep the partner and its people', async () => {
    const p = await partnerProject();
    expect(p).toMatchObject({ kind: 'tasks', partnerName: 'Studio', partnerPeople: ['Asha', 'Ravi'] });
  });

  it('take a Nicobar owner, a partner owner or both, but not neither, and only a partner team name', async () => {
    const p = await partnerProject();
    const base = { teamId: TEAM_ID, dueOn: '2026-10-20', projectId: p.id };
    const both = await s.createTask(db, ME, { ...base, title: 'Box design sign-off', ownerId: ME, partnerOwner: 'Asha' });
    expect(both).toMatchObject({ ownerId: ME, partnerOwner: 'Asha' });
    const theirs = await s.createTask(db, ME, { ...base, title: 'Pack the hampers', ownerId: null, partnerOwner: 'Ravi' });
    expect(theirs).toMatchObject({ ownerId: '', partnerOwner: 'Ravi' });
    expect(await code(s.createTask(db, ME, { ...base, title: 'No owner at all', ownerId: null }))).toBe('400 invalid_body');
    expect(await code(s.createTask(db, ME, { ...base, title: 'Someone else', ownerId: null, partnerOwner: 'Zed' }))).toBe('400 invalid_body');
    expect(await code(s.createTask(db, ME, { teamId: TEAM_ID, dueOn: '2026-10-20', title: 'Not a partner project', ownerId: ME, partnerOwner: 'Asha' }))).toBe('400 invalid_body');
  });

  it('show a partner-only task on the project page only, and let anyone on the project look after it', async () => {
    const p = await partnerProject();
    const t = await s.createTask(db, ME, { teamId: TEAM_ID, dueOn: '2026-10-20', projectId: p.id, title: 'Pack the hampers', ownerId: null, partnerOwner: 'Ravi' });
    expect((await s.teamTasks(db, TEAM_ID)).some((x) => x.id === t.id)).toBe(false);
    expect((await s.projectTasks(db, p.id)).some((x) => x.id === t.id)).toBe(true);
    const moved = await s.editTask(db, MEMBER, t.id, { version: t.version, title: 'Pack the first 200 hampers' });
    expect(moved.title).toBe('Pack the first 200 hampers');
    expect(await code(s.editTask(db, MEMBER, t.id, { version: moved.version, partnerOwner: null }))).toBe('400 invalid_body'); // would leave no owner
  });
});
