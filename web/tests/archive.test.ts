import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Archive and restore a project, the notice to a task's previous owner, and the view-as refusal on both routes.
// Cookies and the database are stubbed the same way as in view-as.test.ts.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { COOKIE, VIEW_COOKIE, signSession, signView } from '../lib/auth';
import { openDb, upgrade, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { archiveProject, createProject, deleteProject, getProject, projectsMayAddTo, restoreProject, updateProject } from '../lib/plan';
import * as s from '../lib/service';
import { TEAM_ID } from '../lib/seed';
import { groupLog } from '../components/logText';
import { POST as archiveRoute } from '../app/api/v1/projects/[id]/archive/route';
import { POST as restoreRoute } from '../app/api/v1/projects/[id]/restore/route';
import { DELETE as deleteRoute } from '../app/api/v1/projects/[id]/route';

const LEAD = 'per_ada';
const ADMIN = 'per_fay';
let db: Db;

beforeAll(() => { process.env.NICO_SESSION_SECRET = 'archive-test-secret'; });
beforeEach(async () => {
  db = await openDb();
  state.testDb = db;
  state.jar = {};
});

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { if (e instanceof ApiError) return `${e.status} ${e.code}`; throw e; }
  return 'ok';
}
async function msg(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { if (e instanceof ApiError) return e.message; throw e; }
  return '';
}

const base = { name: 'Gift wrap drive', kind: 'tasks' as const, ownerId: LEAD, goal: '', workstreams: [], members: [{ personId: 'per_bo', role: 'Packaging' }] };
const task = { teamId: TEAM_ID, title: 'Cut the hamper ribbon', dueOn: '2026-10-20' };
// A project with one task that is already done, so it is ready to archive.
async function doneProject() {
  const p = await createProject(db, LEAD, TEAM_ID, base);
  const t = await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo', projectId: p.id });
  await s.closeTask(db, 'per_bo', t.id, { version: t.version, as: 'done' });
  return { p, t };
}

describe('archiving a project', () => {
  it('is refused while tasks are open, and says how many', async () => {
    const p = await createProject(db, LEAD, TEAM_ID, base);
    await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo', projectId: p.id });
    await s.createTask(db, LEAD, { ...task, title: 'Fold the paper', ownerId: 'per_bo', projectId: p.id });
    expect(await code(archiveProject(db, LEAD, p.id))).toBe('400 open_work');
    expect(await msg(archiveProject(db, LEAD, p.id))).toContain('2 open tasks');
    expect((await getProject(db, p.id)).archivedAt).toBeNull();
  });

  it('is refused while the partner plan has open lines', async () => {
    expect(await msg(archiveProject(db, LEAD, 'prj_studio'))).toMatch(/open (task|line)/);
  });

  it('works once everything is closed, and restore brings it back', async () => {
    const { p } = await doneProject();
    const a = await archiveProject(db, LEAD, p.id);
    expect(a.archivedAt).toBeTruthy();
    expect(a.archivedBy).toBe(LEAD);
    expect(await code(archiveProject(db, LEAD, p.id))).toBe('400 invalid_body'); // already archived
    const r = await restoreProject(db, LEAD, p.id);
    expect(r.archivedAt).toBeNull();
    expect(await code(restoreProject(db, LEAD, p.id))).toBe('400 invalid_body'); // not archived
  });

  it('is open to the project owner, a lead or an admin, and no one else', async () => {
    const own = await createProject(db, LEAD, TEAM_ID, { ...base, name: 'Owned by a member', ownerId: 'per_bo', members: [] });
    const other = await createProject(db, LEAD, TEAM_ID, { ...base, name: 'Lead project' });
    expect(await code(archiveProject(db, 'per_cy', other.id))).toBe('403 not_allowed');
    expect(await code(archiveProject(db, 'per_bo', other.id))).toBe('403 not_allowed'); // a member of it, not owner
    expect(await code(archiveProject(db, 'per_bo', own.id))).toBe('ok'); // its owner
    expect(await code(restoreProject(db, 'per_cy', own.id))).toBe('403 not_allowed');
    expect(await code(restoreProject(db, ADMIN, own.id))).toBe('ok'); // an admin
    expect(await code(archiveProject(db, LEAD, own.id))).toBe('ok'); // a lead
  });

  it('refuses new tasks, moves into it, reopening and edits to the project, until restored', async () => {
    const { p, t } = await doneProject();
    await archiveProject(db, LEAD, p.id);
    expect(await code(s.createTask(db, LEAD, { ...task, ownerId: 'per_bo', projectId: p.id }))).toBe('400 project_archived');
    const closed = await s.getTask(db, t.id);
    expect(await code(s.reopenTask(db, LEAD, t.id, { version: closed.version, reason: 'Needs another look' }))).toBe('400 project_archived');
    const loose = await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo' });
    expect(await code(s.editTask(db, LEAD, loose.id, { version: loose.version, projectId: p.id }))).toBe('400 project_archived');
    expect(await code(updateProject(db, LEAD, p.id, { ...base, name: 'New name' }))).toBe('400 project_archived');
    await restoreProject(db, LEAD, p.id);
    expect(await code(s.createTask(db, LEAD, { ...task, ownerId: 'per_bo', projectId: p.id }))).toBe('ok');
  });

  it('keeps tasks readable and leaves the project out of the "add someone" list', async () => {
    const { p, t } = await doneProject();
    expect(await projectsMayAddTo(db, TEAM_ID, LEAD, true)).toContain(p.id);
    await archiveProject(db, LEAD, p.id);
    expect((await s.getTask(db, t.id)).title).toBe(task.title);
    expect(await projectsMayAddTo(db, TEAM_ID, LEAD, true)).not.toContain(p.id);
    expect((await s.listProjects(db, TEAM_ID)).find((x) => x.id === p.id)?.archived).toBe(true);
  });

  it('logs both moves on the project, and the log reads one sentence for each', async () => {
    const { p } = await doneProject();
    await archiveProject(db, LEAD, p.id);
    await restoreProject(db, LEAD, p.id);
    const log = await s.projectLog(db, p.id);
    const ev = log.filter((e) => e.entity_type === 'project');
    expect(ev.map((e) => e.field).sort()).toEqual(['_archived', '_restored']);
    expect(ev.every((e) => e.taskTitle === p.name)).toBe(true);
    const text = groupLog(log, {}, {}).map((e) => e.text);
    expect(text).toContain('Archived the project');
    expect(text).toContain('Restored the project');
  });
});

describe('telling the previous owner a task moved away', () => {
  const unread = async (id: string) => (await s.listNotices(db, id, true)).filter((n) => n.kind === 'reassigned_away');

  // The old owner made the task, so they still see it once it moves (15 Oct: only an admin sees every task).
  it('leaves an in-app notice for the old owner, and none for the new one', async () => {
    const t = await s.createTask(db, 'per_bo', { ...task, ownerId: 'per_bo' });
    await s.editTask(db, LEAD, t.id, { version: t.version, ownerId: 'per_cy' });
    const gone = await unread('per_bo');
    expect(gone).toHaveLength(1);
    expect(gone[0]).toMatchObject({ taskId: t.id, canOpen: true });
    expect(await unread('per_cy')).toHaveLength(0);
    expect((await s.listNotices(db, 'per_cy', true)).map((n) => n.kind)).toContain('assigned');
  });

  it('still tells the old owner when the task leaves their sight: the title, nothing to open (15 Oct)', async () => {
    const t = await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo' }); // no project, made by the lead
    await s.editTask(db, LEAD, t.id, { version: t.version, ownerId: 'per_cy' });
    const [n] = await unread('per_bo');
    expect(n).toMatchObject({ taskId: t.id, taskTitle: t.title, canOpen: false });
    expect((await s.listNotices(db, 'per_bo')).filter((x) => x.kind !== 'reassigned_away' && x.taskId === t.id)).toEqual([]);
  });

  it('does not notify someone who hands their own task on', async () => {
    const t = await s.createTask(db, LEAD, { ...task, ownerId: LEAD });
    await s.editTask(db, LEAD, t.id, { version: t.version, ownerId: 'per_cy' });
    expect(await unread(LEAD)).toHaveLength(0);
  });

  it('does not notify when the owner stays the same, and the notice can be marked read', async () => {
    const t = await s.createTask(db, 'per_bo', { ...task, ownerId: 'per_bo' });
    const e = await s.editTask(db, LEAD, t.id, { version: t.version, title: 'A new title' });
    expect(await unread('per_bo')).toHaveLength(0);
    await s.editTask(db, LEAD, t.id, { version: e.version, ownerId: 'per_cy' });
    const [n] = await unread('per_bo');
    await s.markNoticeRead(db, 'per_bo', n.id);
    expect(await unread('per_bo')).toHaveLength(0);
  });
});

describe('the upgrade', () => {
  it('can run again on an upgraded database and loses nothing', async () => {
    const { p } = await doneProject();
    await archiveProject(db, LEAD, p.id);
    await upgrade(db);
    await upgrade(db);
    expect((await getProject(db, p.id)).archivedAt).toBeTruthy();
  });

  it('adds the columns and the notice kind to a database made before it', async () => {
    await db.exec(`ALTER TABLE projects DROP COLUMN archived_by; ALTER TABLE projects DROP COLUMN archived_at;
      ALTER TABLE notices DROP CONSTRAINT notices_kind_check;
      ALTER TABLE notices ADD CONSTRAINT notices_kind_check CHECK (kind IN ('due_tomorrow','due_today','overdue','blocked_on_you','assigned'));`);
    await upgrade(db);
    const t = await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo' });
    await s.editTask(db, LEAD, t.id, { version: t.version, ownerId: 'per_cy' });
    expect((await getProject(db, 'prj_landing')).archivedAt).toBeNull();
  });
});

describe('the routes during view-as', () => {
  const post = (url: string) =>
    new Request(`http://localhost${url}`, { method: 'POST', headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, body: '{}' });

  it('refuse archive and restore with 403 viewing_as, and change nothing', async () => {
    const { p } = await doneProject();
    state.jar = { [COOKIE]: signSession(ADMIN), [VIEW_COOKIE]: signView(ADMIN, LEAD) };
    const params = { params: Promise.resolve({ id: p.id }) };
    const a = await archiveRoute(post(`/api/v1/projects/${p.id}/archive`), params);
    expect(a.status).toBe(403);
    expect((await a.json()).error.code).toBe('viewing_as');
    expect((await getProject(db, p.id)).archivedAt).toBeNull();
    await archiveProject(db, LEAD, p.id);
    const r = await restoreRoute(post(`/api/v1/projects/${p.id}/restore`), params);
    expect(r.status).toBe(403);
    expect((await getProject(db, p.id)).archivedAt).toBeTruthy();
  });

  it('archive and restore work for the admin when not viewing as anyone', async () => {
    const { p } = await doneProject();
    state.jar = { [COOKIE]: signSession(ADMIN) };
    const params = { params: Promise.resolve({ id: p.id }) };
    expect((await archiveRoute(post(`/api/v1/projects/${p.id}/archive`), params)).status).toBe(200);
    expect((await restoreRoute(post(`/api/v1/projects/${p.id}/restore`), params)).status).toBe(200);
  });
});

describe('a project lead who does not own it', () => {
  // per_cy leads, per_bo is a plain member, and neither holds the lead or admin role on the team.
  const withLead = { ...base, leadId: 'per_cy' };
  const joiner = { ...task, ownerRole: 'Gift wrap' };

  it('can archive, restore, edit and add a person, as the owner can', async () => {
    const p = await createProject(db, LEAD, TEAM_ID, withLead);
    expect(await code(archiveProject(db, 'per_cy', p.id))).toBe('ok');
    expect((await getProject(db, p.id)).archivedAt).not.toBeNull();
    expect(await code(restoreProject(db, 'per_cy', p.id))).toBe('ok');
    expect(await code(updateProject(db, 'per_cy', p.id, { ...withLead, goal: 'Edited by the lead' }))).toBe('ok');
    expect(await code(s.createTask(db, 'per_cy', { ...joiner, ownerId: 'per_dee', projectId: p.id }))).toBe('ok');
    expect(await projectsMayAddTo(db, TEAM_ID, 'per_cy', false)).toContain(p.id); // per_cy also owns a fixture project
  });

  it('is not a stand-in for a plain member, who can do none of it', async () => {
    const p = await createProject(db, LEAD, TEAM_ID, withLead);
    expect(await code(archiveProject(db, 'per_bo', p.id))).toBe('403 not_allowed');
    expect(await code(updateProject(db, 'per_bo', p.id, { ...withLead, goal: 'Nope' }))).toBe('403 not_allowed');
    expect(await code(s.createTask(db, 'per_bo', { ...joiner, ownerId: 'per_dee', projectId: p.id }))).toBe('403 not_allowed');
    expect(await projectsMayAddTo(db, TEAM_ID, 'per_bo', false)).toEqual([]);
  });

  it('logs a change of owner or lead as a project event', async () => {
    const p = await createProject(db, LEAD, TEAM_ID, withLead);
    await updateProject(db, 'per_cy', p.id, { ...withLead, leadId: 'per_dee' });
    await updateProject(db, LEAD, p.id, { ...withLead, ownerId: 'per_dee', leadId: null });
    const names = { per_ada: 'Ada', per_cy: 'Cy', per_dee: 'Dee', per_bo: 'Bo' };
    const lines = groupLog(await s.projectLog(db, p.id, 20), names, { [p.id]: p.name }).map((e) => e.text);
    expect(lines).toEqual(expect.arrayContaining(['Project lead changed to Dee', 'Project owner changed to Dee']));
  });
});

describe('archiving with open work dropped (26 Oct)', () => {
  it('drops every open task with the reason, logs each drop, and archives in one step', async () => {
    const p = await createProject(db, LEAD, TEAM_ID, base);
    const a = await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo', projectId: p.id });
    const b = await s.createTask(db, LEAD, { ...task, title: 'Fold the paper', ownerId: 'per_bo', projectId: p.id });
    await s.closeTask(db, 'per_bo', b.id, { version: b.version, as: 'done' });
    const r = await archiveProject(db, 'per_bo', p.id, 'Pilot test project').catch((e) => e);
    expect(r).toBeInstanceOf(ApiError); // a plain member still cannot
    const out = await archiveProject(db, LEAD, p.id, 'Pilot test project');
    expect(out.archivedAt).toBeTruthy();
    const ta = await s.getTask(db, a.id);
    expect(ta.statusCategory).toBe('dropped');
    expect(ta.version).toBe(a.version + 1);
    expect((await s.getTask(db, b.id)).statusCategory).toBe('done'); // done work stays done
    const ev = (await s.projectLog(db, p.id)).filter((e) => e.entity_id === a.id && e.field === 'status_category');
    expect(ev.at(-1)?.reason).toBe('Pilot test project');
    await restoreProject(db, LEAD, p.id);
    expect((await getProject(db, p.id)).archivedAt).toBeNull();
  });

  it('removes open plan lines with the reason, and refuses an empty reason', async () => {
    expect(await code(archiveProject(db, LEAD, 'prj_studio', '  '))).toBe('400 reason_required');
    expect((await getProject(db, 'prj_studio')).archivedAt).toBeNull();
    await archiveProject(db, LEAD, 'prj_studio', 'Wound up early');
    const { rows } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM plan_lines WHERE project_id = 'prj_studio' AND NOT removed AND status <> 'Done'`);
    expect(rows[0].n).toBe(0);
  });

  it('works through the route with a JSON reason, and still refuses with no body', async () => {
    const p = await createProject(db, LEAD, TEAM_ID, base);
    await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo', projectId: p.id });
    state.jar = { [COOKIE]: signSession(LEAD) };
    const params = { params: Promise.resolve({ id: p.id }) };
    const bare = new Request(`http://localhost/api/v1/projects/${p.id}/archive`, { method: 'POST', headers: { origin: 'http://localhost', host: 'localhost' } });
    const r1 = await archiveRoute(bare, params);
    expect(r1.status).toBe(400);
    expect((await r1.json()).error.code).toBe('open_work');
    const withReason = new Request(`http://localhost/api/v1/projects/${p.id}/archive`, { method: 'POST', headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, body: JSON.stringify({ dropOpen: 'Not needed' }) });
    expect((await archiveRoute(withReason, params)).status).toBe(200);
  });
});

describe('deleting a project for good (26 Oct)', () => {
  // A project with a little of everything hanging on it.
  async function full() {
    const p = await createProject(db, LEAD, TEAM_ID, base);
    const t = await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo', projectId: p.id });
    await db.query(`INSERT INTO comments (id, subject_kind, subject_id, author_id, body, created_at) SELECT 'cmt_x', 'task', $1, 'per_ada', 'Note', now()`, [t.id]).catch(() => undefined);
    await archiveProject(db, LEAD, p.id, 'Test project');
    return { p, t };
  }

  it('is refused to a lead, to an unarchived project, and to a wrong name', async () => {
    const { p } = await full();
    expect(await code(deleteProject(db, LEAD, p.id, p.name))).toBe('403 not_allowed');
    expect(await code(deleteProject(db, ADMIN, p.id, 'Something else'))).toBe('400 invalid_body');
    const live = await createProject(db, LEAD, TEAM_ID, { ...base, name: 'Still live' });
    expect(await code(deleteProject(db, ADMIN, live.id, 'Still live'))).toBe('400 not_archived');
    expect((await getProject(db, p.id)).id).toBe(p.id);
  });

  it('removes the project, its tasks and what hangs on them, and keeps the log with a _deleted event', async () => {
    const { p, t } = await full();
    const out = await deleteProject(db, ADMIN, p.id, p.name.toUpperCase());
    expect(out).toEqual({ deleted: p.id, tasks: 1 });
    expect(await code(getProject(db, p.id))).toBe('404 not_found');
    const { rows: left } = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM tasks WHERE id = $1`, [t.id]);
    expect(left[0].n).toBe(0);
    const { rows: ev } = await db.query<{ field: string }>(`SELECT field FROM events WHERE entity_id IN ($1, $2)`, [p.id, t.id]);
    expect(ev.map((e) => e.field)).toEqual(expect.arrayContaining(['_created', '_archived', '_deleted', 'status_category']));
  });

  it('deletes a partner plan with its lines, asks and activity', async () => {
    await archiveProject(db, LEAD, 'prj_studio', 'Wound up');
    const name = (await getProject(db, 'prj_studio')).name;
    await deleteProject(db, ADMIN, 'prj_studio', name);
    const { rows } = await db.query<{ n: number }>(`SELECT (SELECT count(*) FROM plan_lines WHERE project_id = 'prj_studio') + (SELECT count(*) FROM plan_activity WHERE project_id = 'prj_studio')::int AS n`);
    expect(Number(rows[0].n)).toBe(0);
  });

  it('keeps every other plan\'s activity log append-only while one is purged', async () => {
    await expect(db.transaction(async (tx) => {
      await tx.query(`SELECT set_config('nico.purging', 'prj_other', true)`);
      await tx.query(`DELETE FROM plan_activity WHERE project_id = 'prj_studio'`);
    })).rejects.toThrow(/append-only/);
  });

  it('goes through the DELETE route for an admin, and view-as refuses it', async () => {
    const { p } = await full();
    const params = { params: Promise.resolve({ id: p.id }) };
    const del = () => new Request(`http://localhost/api/v1/projects/${p.id}`, { method: 'DELETE', headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, body: JSON.stringify({ name: p.name }) });
    state.jar = { [COOKIE]: signSession(ADMIN), [VIEW_COOKIE]: signView(ADMIN, LEAD) };
    expect((await deleteRoute(del(), params)).status).toBe(403);
    state.jar = { [COOKIE]: signSession(ADMIN) };
    expect((await deleteRoute(del(), params)).status).toBe(200);
  });
});

describe('a project with a deactivated member (28 Oct)', () => {
  it('can still be edited and take someone new, but takes no one inactive', async () => {
    const p = await createProject(db, LEAD, TEAM_ID, base);
    await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo', projectId: p.id });
    await db.query(`UPDATE people SET active = false WHERE id = 'per_bo'`);
    const withDee = { ...base, members: [...base.members, { personId: 'per_dee', role: 'Ribbons' }] };
    expect(await code(updateProject(db, ADMIN, p.id, withDee))).toBe('ok');
    const on = (await db.query<{ person_id: string }>(`SELECT person_id FROM project_members WHERE project_id = $1`, [p.id])).rows.map((r) => r.person_id);
    expect(on).toEqual(expect.arrayContaining(['per_bo', 'per_dee']));
    await db.query(`UPDATE people SET active = false WHERE id = 'per_cy'`);
    expect(await code(updateProject(db, ADMIN, p.id, { ...withDee, members: [...withDee.members, { personId: 'per_cy', role: 'Tags' }] }))).toBe('400 owner_not_on_roster');
  });
});
