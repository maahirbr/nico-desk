import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { createProject, getProject, reorderWorkstreams } from '../lib/plan';
import { TEAM_ID } from '../lib/seed';

// The order of a task board's sub-projects (23 Nov): same names, new order, by whoever can change Settings.
const ME = 'per_ada', MEMBER = 'per_bo';
let db: Db;
beforeAll(() => { process.env.NICO_TODAY = '2026-10-09'; });
beforeEach(async () => { db = await openDb(); });
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status}` : (() => { throw e; })()));

describe('sub-project order', () => {
  it('saves a new order for the owner, and refuses a member or a changed list', async () => {
    const p = await createProject(db, ME, TEAM_ID, { name: 'Drops', kind: 'tasks', ownerId: ME, goal: 'Six drops', workstreams: ['Drop 1', 'Drop 2', 'Drop 3'], members: [{ personId: MEMBER, role: 'Design' }] });
    await reorderWorkstreams(db, ME, p.id, ['Drop 3', 'Drop 1', 'Drop 2']);
    expect((await getProject(db, p.id)).workstreams).toEqual(['Drop 3', 'Drop 1', 'Drop 2']);
    expect(await code(reorderWorkstreams(db, MEMBER, p.id, ['Drop 1', 'Drop 2', 'Drop 3']))).toBe('403');
    expect(await code(reorderWorkstreams(db, ME, p.id, ['Drop 1', 'Drop 2']))).toBe('400');
  });
});
