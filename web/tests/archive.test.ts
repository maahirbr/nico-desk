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
import { archiveProject, createProject, getProject, projectsMayAddTo, restoreProject, updateProject } from '../lib/plan';
import * as s from '../lib/service';
import { TEAM_ID } from '../lib/seed';
import { groupLog } from '../components/logText';
import { POST as archiveRoute } from '../app/api/v1/projects/[id]/archive/route';
import { POST as restoreRoute } from '../app/api/v1/projects/[id]/restore/route';

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

  it('leaves an in-app notice for the old owner, and none for the new one', async () => {
    const t = await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo' });
    await s.editTask(db, LEAD, t.id, { version: t.version, ownerId: 'per_cy' });
    const gone = await unread('per_bo');
    expect(gone).toHaveLength(1);
    expect(gone[0].taskId).toBe(t.id);
    expect(await unread('per_cy')).toHaveLength(0);
    expect((await s.listNotices(db, 'per_cy', true)).map((n) => n.kind)).toContain('assigned');
  });

  it('does not notify someone who hands their own task on', async () => {
    const t = await s.createTask(db, LEAD, { ...task, ownerId: LEAD });
    await s.editTask(db, LEAD, t.id, { version: t.version, ownerId: 'per_cy' });
    expect(await unread(LEAD)).toHaveLength(0);
  });

  it('does not notify when the owner stays the same, and the notice can be marked read', async () => {
    const t = await s.createTask(db, LEAD, { ...task, ownerId: 'per_bo' });
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
