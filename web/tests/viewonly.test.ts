import { beforeEach, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { addProjectPeople, getProject, planOp, projectAccess, updateProject } from '../lib/plan';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { isViewOnly, viewOnlyProjects } from '../lib/sight';

// View-only (15 Nov): someone who may view a project but is not on it only views it. No new tasks, no minutes.
let db: Db;
beforeEach(async () => { process.env.NICO_TODAY = '2026-10-09'; db = await openDb(); });
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status} ${e.code}` : (() => { throw e; })()));

async function setup() {
  const { rows: [pr] } = await db.query<{ id: string; owner_id: string }>(
    `SELECT id, owner_id FROM projects WHERE team_id = $1 AND kind = 'tasks' AND archived_at IS NULL AND personal_for IS NULL ORDER BY id LIMIT 1`, [TEAM_ID]);
  const { rows: [out] } = await db.query<{ id: string }>(
    `SELECT p.id FROM people p JOIN team_members t ON t.person_id = p.id AND t.team_id = $1
      WHERE p.active AND t.app_role = 'member' AND p.id <> $2
        AND NOT EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = $3 AND m.person_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM projects x WHERE x.id = $3 AND (x.owner_id = p.id OR x.lead_id = p.id))
        AND NOT EXISTS (SELECT 1 FROM team_members a WHERE a.person_id = p.id AND a.app_role IN ('lead','admin')) ORDER BY p.id LIMIT 1`,
    [TEAM_ID, pr.owner_id, pr.id]);
  await db.query(`INSERT INTO project_viewers (project_id, person_id, added_by) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [pr.id, out.id, pr.owner_id]);
  return { projectId: pr.id, ownerId: pr.owner_id, viewer: out.id };
}

describe('a view-only person', () => {
  it('is marked view-only on that project, and the owner is not', async () => {
    const { projectId, ownerId, viewer } = await setup();
    expect(await isViewOnly(db, TEAM_ID, projectId, viewer)).toBe(true);
    expect((await viewOnlyProjects(db, TEAM_ID, ownerId)).has(projectId)).toBe(false);
  });
  it('cannot add a task, even for the owner, or import minutes', async () => {
    const { projectId, ownerId, viewer } = await setup();
    expect(await code(s.createTask(db, viewer, { teamId: TEAM_ID, title: 'From a viewer', ownerId, dueOn: '2026-10-20', projectId }))).toBe('403 not_allowed');
    expect(await code(planOp(db, viewer, projectId, { op: 'importMinutes', text: 'Sam to send the deck by Friday.' } as never))).toBe('403 not_allowed');
    // The owner still can.
    expect(await code(s.createTask(db, ownerId, { teamId: TEAM_ID, title: 'From the owner', ownerId, dueOn: '2026-10-20', projectId }))).toBe('ok');
  });
});

describe('project Settings rights (15 Nov)', () => {
  it('full for the owner, add-people for a member, view for a viewer', async () => {
    const { projectId, ownerId, viewer } = await setup();
    const { rows: [mem] } = await db.query<{ person_id: string }>(`SELECT person_id FROM project_members WHERE project_id = $1 AND person_id <> $2 LIMIT 1`, [projectId, ownerId]);
    const p = await getProject(db, projectId);
    expect(await projectAccess(db, p, ownerId)).toBe('full');
    expect(await projectAccess(db, p, viewer)).toBe('view');
    if (mem) {
      const roles = (await db.query<{ app_role: string }>(`SELECT app_role FROM team_members WHERE person_id = $1`, [mem.person_id])).rows.map((r) => r.app_role);
      if (!roles.includes('admin') && !roles.includes('lead')) {
        expect(await projectAccess(db, p, mem.person_id)).toBe('people');
        // A member may add someone, but not change the project itself.
        await addProjectPeople(db, mem.person_id, projectId, [{ personId: viewer, role: 'Design' }]);
        const { rows } = await db.query(`SELECT 1 FROM project_members WHERE project_id = $1 AND person_id = $2`, [projectId, viewer]);
        expect(rows.length).toBe(1);
        expect(await isViewOnly(db, TEAM_ID, projectId, viewer)).toBe(false); // no longer only a viewer
        expect(await code(updateProject(db, mem.person_id, projectId, { name: 'Renamed', kind: p.kind, ownerId: p.ownerId } as never))).toBe('403 not_allowed');
      }
    }
    // A viewer may not add anyone.
    const { rows: [other] } = await db.query<{ id: string }>(`SELECT id FROM people WHERE active AND id NOT IN ($1, $2) LIMIT 1`, [ownerId, viewer]);
    const fresh = await setup2(projectId);
    expect(await code(addProjectPeople(db, fresh, projectId, [{ personId: other.id, role: 'Help' }]))).toBe('403 not_allowed');
  });
});

async function setup2(projectId: string): Promise<string> {
  const { rows: [v] } = await db.query<{ id: string }>(
    `SELECT p.id FROM people p JOIN team_members t ON t.person_id = p.id AND t.team_id = $1 AND t.app_role = 'member'
      WHERE p.active AND NOT EXISTS (SELECT 1 FROM project_members m WHERE m.project_id = $2 AND m.person_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM projects x WHERE x.id = $2 AND (x.owner_id = p.id OR x.lead_id = p.id))
        AND NOT EXISTS (SELECT 1 FROM team_members a WHERE a.person_id = p.id AND a.app_role IN ('lead','admin')) ORDER BY p.id LIMIT 1`, [TEAM_ID, projectId]);
  await db.query(`INSERT INTO project_viewers (project_id, person_id, added_by) VALUES ($1, $2, $2) ON CONFLICT DO NOTHING`, [projectId, v.id]);
  return v.id;
}

describe('comments from a view-only person (15 Nov)', () => {
  it('are refused on the project and its tasks; the owner still comments', async () => {
    const { addComment } = await import('../lib/comments');
    const { projectId, ownerId, viewer } = await setup();
    const t = await s.createTask(db, ownerId, { teamId: TEAM_ID, title: 'Print the labels', ownerId, dueOn: '2026-10-20', projectId });
    const people = await s.listPeople(db, TEAM_ID);
    const meOf = (id: string) => { const p = people.find((x) => x.id === id)!; return { person: p, realPerson: p, viewingAs: false, team: { id: TEAM_ID, name: 'Team', teamType: 'department' } } as never; };
    expect(await code(addComment(db, meOf(viewer), 'task', t.id, 'Looks good'))).toBe('403 not_allowed');
    expect(await code(addComment(db, meOf(viewer), 'project', projectId, 'Looks good'))).toBe('403 not_allowed');
    expect(await code(addComment(db, meOf(ownerId), 'task', t.id, 'On it'))).toBe('ok');
  });
});
