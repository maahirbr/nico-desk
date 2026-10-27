import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Links on a task: the URL rules, who may add and remove, the caps, the event each action writes, and the view-as refusal.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { COOKIE, signSession, signView, VIEW_COOKIE } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { checkLinkUrl, linkText, LINKS_PER_TASK, siteOf } from '../lib/links';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { groupLog } from '../components/logText';
import { POST as addRoute } from '../app/api/v1/tasks/[id]/links/route';
import { DELETE as removeRoute } from '../app/api/v1/tasks/[id]/links/[linkId]/route';

const AS_OF = '2026-10-09';
const LEAD = 'per_ada';
const ADMIN = 'per_fay';
let db: Db;

beforeAll(() => { process.env.NICO_TODAY = AS_OF; process.env.NICO_SESSION_SECRET = 'links-test-secret'; });
beforeEach(async () => { db = await openDb(); state.testDb = db; state.jar = {}; });

async function code(p: Promise<unknown>): Promise<string> {
  try { await p; } catch (e) { if (e instanceof ApiError) return `${e.status} ${e.code}`; throw e; }
  return 'ok';
}

// An open app task owned by someone who is neither a lead nor an admin, and a plain member who has no hand in it.
async function setup() {
  const people = await s.listPeople(db, TEAM_ID);
  const plain = people.filter((p) => p.active && p.appRoles.length === 1 && p.appRoles[0] === 'member');
  const tasks = await s.teamTasks(db, TEAM_ID, AS_OF);
  const task = tasks.find((t) => t.origin === 'app' && t.statusCategory === 'open' && plain.some((p) => p.id === t.ownerId) && !plain.some((p) => p.id === t.createdBy && p.id !== t.ownerId));
  if (!task) throw new Error('fixture has no open app task owned by a plain member');
  const owner = task.ownerId;
  const stranger = plain.find((p) => p.id !== owner && p.id !== task.createdBy);
  if (!stranger) throw new Error('fixture has no second plain member');
  return { task, owner, stranger: stranger.id };
}
const events = async (taskId: string) => (await s.taskLog(db, taskId)).filter((e) => e.field.startsWith('_link'));
const DOC = 'https://docs.google.com/document/d/abc123/edit';

describe('link URL rules', () => {
  it('takes http and https only, with no sign-in details, and stores the clean address', () => {
    expect(checkLinkUrl(` ${DOC} `)).toEqual({ url: DOC });
    expect(checkLinkUrl('http://example.com/a?b=1')).toEqual({ url: 'http://example.com/a?b=1' });
    for (const bad of ['', '   ', 'javascript:alert(1)', 'data:text/html,hi', 'file:///etc/passwd', 'ftp://example.com/a', 'example.com', 'not a url',
      'https://user:pass@example.com/', 'https://localhost/x', `https://example.com/${'a'.repeat(2000)}`, 42, null]) {
      expect('error' in checkLinkUrl(bad), String(bad)).toBe(true);
    }
  });

  it('picks a built-in icon by host, and names a chip from the label or the site', () => {
    expect(siteOf('https://docs.google.com/document/d/x')).toBe('docs');
    expect(siteOf('https://docs.google.com/spreadsheets/d/x')).toBe('sheets');
    expect(siteOf('https://docs.google.com/presentation/d/x')).toBe('slides');
    expect(siteOf('https://www.figma.com/design/x')).toBe('figma');
    expect(siteOf('https://drive.google.com/file/d/x')).toBe('drive');
    expect(siteOf('https://example.com/x')).toBe('generic');
    expect(siteOf('https://notfigma.com/x')).toBe('generic');
    expect(linkText({ url: 'https://example.com/x', label: 'Brief' })).toBe('Brief');
    expect(linkText({ url: 'https://www.example.com/x', label: null })).toBe('example.com');
    expect(linkText({ url: 'https://docs.google.com/spreadsheets/d/x', label: null })).toBe('Google Sheet');
  });
});

describe('adding and removing a link', () => {
  it('lets the owner add one; it shows on the task and writes one event', async () => {
    const { task, owner } = await setup();
    const l = await s.addTaskLink(db, owner, task.id, { url: DOC, label: ' Brief ' });
    expect(l).toMatchObject({ taskId: task.id, url: DOC, label: 'Brief', createdBy: owner });
    expect((await s.getTask(db, task.id, AS_OF)).links.map((x) => x.id)).toEqual([l.id]);
    const ev = await events(task.id);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ field: '_link_added', actor_id: owner, after: { id: l.id, url: DOC, label: 'Brief' } });
    expect((await s.getTask(db, task.id, AS_OF)).version).toBe(task.version); // a link takes no version
  });

  it('removes it, writes one event, and the update log reads one sentence for each action', async () => {
    const { task, owner } = await setup();
    const a = await s.addTaskLink(db, owner, task.id, { url: DOC });
    const b = await s.addTaskLink(db, owner, task.id, { url: 'https://www.figma.com/design/xyz', label: 'Mockups' });
    await s.removeTaskLink(db, owner, task.id, a.id);
    expect((await s.getTask(db, task.id, AS_OF)).links.map((x) => x.id)).toEqual([b.id]);
    const texts = groupLog(await events(task.id), {}, {}).map((e) => e.text);
    expect(texts).toEqual(['Removed link “Google Doc”', 'Added link “Mockups”', 'Added link “Google Doc”']);
  });

  it('refuses a bad URL, a long label and a repeat of the same link', async () => {
    const { task, owner } = await setup();
    expect(await code(s.addTaskLink(db, owner, task.id, { url: 'javascript:alert(1)' }))).toBe('400 invalid_link');
    expect(await code(s.addTaskLink(db, owner, task.id, { url: DOC, label: 'x'.repeat(81) }))).toBe('400 invalid_link');
    await s.addTaskLink(db, owner, task.id, { url: DOC });
    expect(await code(s.addTaskLink(db, owner, task.id, { url: DOC }))).toBe('400 duplicate_link');
    expect(await events(task.id)).toHaveLength(1); // the refusals wrote nothing
  });

  it('stops at the per-task cap', async () => {
    const { task, owner } = await setup();
    for (let i = 0; i < LINKS_PER_TASK; i++) await s.addTaskLink(db, owner, task.id, { url: `https://example.com/page/${i}` });
    expect(await code(s.addTaskLink(db, owner, task.id, { url: 'https://example.com/one-more' }))).toBe('400 too_many_links');
    expect((await s.getTask(db, task.id, AS_OF)).links).toHaveLength(LINKS_PER_TASK);
  });

  it('refuses removing a link that is not on that task, and one that is already gone', async () => {
    const { task, owner } = await setup();
    const other = (await s.teamTasks(db, TEAM_ID, AS_OF)).find((t) => t.id !== task.id && t.origin === 'app' && t.ownerId === owner) ?? task;
    const l = await s.addTaskLink(db, owner, task.id, { url: DOC });
    if (other.id !== task.id) expect(await code(s.removeTaskLink(db, owner, other.id, l.id))).toBe('404 not_found');
    await s.removeTaskLink(db, owner, task.id, l.id);
    expect(await code(s.removeTaskLink(db, owner, task.id, l.id))).toBe('404 not_found');
  });
});

describe('who may change links (the rule for editing the task)', () => {
  it('lets a lead and an admin, refuses a member with no hand in the task', async () => {
    const { task, stranger } = await setup();
    expect(await code(s.addTaskLink(db, stranger, task.id, { url: DOC }))).toBe('403 not_allowed');
    expect(await code(s.addTaskLink(db, LEAD, task.id, { url: DOC }))).toBe('ok');
    const l = (await s.getTask(db, task.id, AS_OF)).links[0];
    expect(await code(s.removeTaskLink(db, stranger, task.id, l.id))).toBe('403 not_allowed');
    expect(await code(s.addTaskLink(db, ADMIN, task.id, { url: 'https://example.com/a' }))).toBe('ok');
    expect(await code(s.removeTaskLink(db, ADMIN, task.id, l.id))).toBe('ok');
  });

  it('lets the person who made the task', async () => {
    const { task, stranger } = await setup();
    await db.query('UPDATE tasks SET created_by = $2 WHERE id = $1', [task.id, stranger]);
    expect(await code(s.addTaskLink(db, stranger, task.id, { url: DOC }))).toBe('ok');
  });

  it('refuses someone off the team, a Sheet mirror, and a task that does not exist', async () => {
    const { task, owner } = await setup();
    await db.query(`INSERT INTO people (id, display_name, role, department, email) VALUES ('per_out', 'Out Sider', 'x', 'x', 'out@example.test')`);
    expect(await code(s.addTaskLink(db, 'per_out', task.id, { url: DOC }))).toBe('403 not_allowed');
    expect(await code(s.addTaskLink(db, owner, 'tsk_nope', { url: DOC }))).toBe('404 not_found');
    const sheet = (await s.teamTasks(db, TEAM_ID, AS_OF)).find((t) => t.origin === 'sheet');
    if (sheet) expect(await code(s.addTaskLink(db, LEAD, sheet.id, { url: DOC }))).toBe('403 read_only_mirror');
  });
});

describe('the API', () => {
  const req = (method: string, url: string, body?: unknown) =>
    new Request(`http://localhost${url}`, { method, headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const asLead = () => { state.jar = { [COOKIE]: signSession(LEAD) }; };

  it('adds with POST and removes with DELETE; an unknown body field is refused', async () => {
    const { task } = await setup();
    asLead();
    const res = await addRoute(req('POST', `/api/v1/tasks/${task.id}/links`, { url: DOC }), { params: Promise.resolve({ id: task.id }) });
    expect(res.status).toBe(200);
    const link = await res.json();
    expect(link.url).toBe(DOC);
    const stray = await addRoute(req('POST', `/api/v1/tasks/${task.id}/links`, { url: 'https://example.com/x', taskId: 'other' }), { params: Promise.resolve({ id: task.id }) });
    expect(stray.status).toBe(400);
    const del = await removeRoute(req('DELETE', `/api/v1/tasks/${task.id}/links/${link.id}`), { params: Promise.resolve({ id: task.id, linkId: link.id }) });
    expect(del.status).toBe(204);
    expect((await s.getTask(db, task.id, AS_OF)).links).toHaveLength(0);
  });

  it('is refused while an admin views as someone else, and records nothing', async () => {
    const { task, owner } = await setup();
    const l = await s.addTaskLink(db, owner, task.id, { url: DOC });
    const before = (await events(task.id)).length;
    state.jar = { [COOKIE]: signSession(ADMIN), [VIEW_COOKIE]: signView(ADMIN, owner) };
    const add = await addRoute(req('POST', `/api/v1/tasks/${task.id}/links`, { url: 'https://example.com/y' }), { params: Promise.resolve({ id: task.id }) });
    expect(add.status).toBe(403);
    expect((await add.json()).error.code).toBe('viewing_as');
    const del = await removeRoute(req('DELETE', `/api/v1/tasks/${task.id}/links/${l.id}`), { params: Promise.resolve({ id: task.id, linkId: l.id }) });
    expect(del.status).toBe(403);
    expect((await events(task.id)).length).toBe(before);
    expect((await s.getTask(db, task.id, AS_OF)).links).toHaveLength(1);
  });

  it('refuses a signed-out caller and a cross-site request', async () => {
    const { task } = await setup();
    const out = await addRoute(req('POST', `/api/v1/tasks/${task.id}/links`, { url: DOC }), { params: Promise.resolve({ id: task.id }) });
    expect(out.status).toBe(401);
    asLead();
    const evil = new Request(`http://localhost/api/v1/tasks/${task.id}/links`, { method: 'POST', headers: { origin: 'http://evil.test', host: 'localhost', 'content-type': 'application/json' }, body: JSON.stringify({ url: DOC }) });
    expect((await addRoute(evil, { params: Promise.resolve({ id: task.id }) })).status).toBe(403);
  });
});
