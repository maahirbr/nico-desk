import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { createProject } from '../lib/plan';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

// An owner hands their own task to someone else on the project (3 Nov): the new owner, the project's owner and its lead
// hear of it in the app.
const LEAD = 'per_ada', OWNER = 'per_cy', TAKER = 'per_dee', PROJ_OWNER = 'per_bo';
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });

describe('reassigning your own task', () => {
  it('is allowed to the owner, and tells the new owner and the project owner and lead', async () => {
    const p = await createProject(db, LEAD, TEAM_ID, { name: 'Gift wrap trial', kind: 'tasks', ownerId: PROJ_OWNER, goal: 'Try three wraps', workstreams: [],
      members: [{ personId: OWNER, role: 'Design' }, { personId: TAKER, role: 'Sourcing' }] });
    const t = await s.createTask(db, LEAD, { teamId: TEAM_ID, title: 'Pick the ribbon', ownerId: OWNER, dueOn: '2026-10-20', projectId: p.id });
    await new Promise((r) => setTimeout(r, 5));
    const moved = await s.editTask(db, OWNER, t.id, { version: t.version, ownerId: TAKER });
    expect(moved.ownerId).toBe(TAKER);
    const later = new Date(Date.now() + 1000);
    const said = async (id: string) => (await s.updatesView(db, id, TEAM_ID, {}, {}, null, later)).items.filter((i) => i.taskId === t.id).map((i) => i.kind);
    expect(await said(TAKER)).toContain('assigned');
    expect(await said(PROJ_OWNER)).toContain('reassigned');
    expect((await s.listNotices(db, TAKER, true)).some((n) => n.taskId === t.id && n.kind === 'assigned')).toBe(true);
  });
});
