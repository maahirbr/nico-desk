import { beforeAll, describe, expect, it, vi } from 'vitest';

// Partner access (20 Nov, the PM's call): someone from an outside company, on the roster as Partner (member + partner), whose
// company is their department. They sign in with their own address, see only their projects, have no Personal, and give
// tasks only to themselves or their own company's people. They cannot start projects, change Settings or add people.

const state = vi.hoisted(() => ({ testDb: null as unknown, jar: {} as Record<string, string> }));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
}));

import { checkSignIn, COOKIE, resolveMe, signSession } from '../lib/auth';
import { GET as feedbackGet } from '../app/api/v1/feedback/route';
import { GET as searchGet } from '../app/api/v1/search/route';
import { openDb, type Db } from '../lib/db';
import { ApiError } from '../lib/errors';
import { addProjectPeople, createProject, getProject, projectAccess, updateProject } from '../lib/plan';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { sightFor } from '../lib/visibility';

const ADMIN = 'per_fay';
let db: Db;
const code = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof ApiError ? `${e.status}` : (() => { throw e; })()));
let asha: string, ravi: string, other: string, projectId: string, ownerId: string;

beforeAll(async () => {
  process.env.NICO_TODAY = '2026-10-09';
  db = await openDb();
  state.testDb = db;
  const add = (name: string, email: string, company: string) =>
    s.addPerson(db, ADMIN, TEAM_ID, { displayName: name, role: 'Consultant', department: company, email, appRoles: ['partner'] });
  asha = (await add('Asha Crux', 'asha@crux.example', 'TheCRUX')).id;
  ravi = (await add('Ravi Crux', 'ravi@crux.example', 'TheCRUX')).id;
  other = (await add('Mona Other', 'mona@other.example', 'OtherCo')).id;
  const { rows: [p] } = await db.query<{ id: string; owner_id: string }>(
    `SELECT id, owner_id FROM projects WHERE team_id = $1 AND kind = 'tasks' AND archived_at IS NULL AND personal_for IS NULL ORDER BY id LIMIT 1`, [TEAM_ID]);
  projectId = p.id; ownerId = p.owner_id;
  await addProjectPeople(db, ownerId, projectId, [{ personId: asha, role: 'Partner' }, { personId: ravi, role: 'Partner' }, { personId: other, role: 'Partner' }]);
});

describe('a partner on the roster', () => {
  it('is never Leadership or an Admin as well', async () => {
    expect(await code(s.addPerson(db, ADMIN, TEAM_ID, { displayName: 'Both Ways', role: 'X', department: 'Y', email: 'both@x.example', appRoles: ['partner', 'admin'] }))).toBe('400');
  });
  it('signs in with their own address; an outside address that is not a partner does not', async () => {
    expect(await checkSignIn('asha@crux.example')).toEqual({ ok: true, personId: asha });
    expect((await checkSignIn('stranger@nowhere.example')).ok).toBe(false);
    expect((await resolveMe(db, asha))?.person.id).toBe(asha);
  });
});

describe('what a partner sees and does', () => {
  it('sees only the projects they are on', async () => {
    const me = (await resolveMe(db, asha))!;
    const sight = await sightFor(db, me);
    expect(sight.all).toBe(false);
    if (!sight.all) expect([...sight.projects]).toEqual([projectId]);
  });
  it('gives tasks only to themselves or their own company, and only on a project', async () => {
    const base = { teamId: TEAM_ID, title: 'Send the moodboard', dueOn: '2026-10-20', projectId };
    expect(await code(s.createTask(db, asha, { ...base, ownerId: asha }))).toBe('ok');
    expect(await code(s.createTask(db, asha, { ...base, ownerId: ravi }))).toBe('ok');
    expect(await code(s.createTask(db, asha, { ...base, ownerId: other }))).toBe('403');
    expect(await code(s.createTask(db, asha, { ...base, ownerId: ownerId }))).toBe('403');
    expect(await code(s.createTask(db, asha, { ...base, projectId: undefined, ownerId: asha }))).toBe('400');
  });
  // 22 Nov: two paths that skipped the partner rule.
  it('has a typed sentence read against their own company only, not the whole roster', async () => {
    const { readSentence } = await import('../lib/sentenceRead');
    const { rows: [staff] } = await db.query<{ id: string; display_name: string }>(
      `SELECT id, display_name FROM people WHERE active AND id <> $1 AND id NOT IN (SELECT person_id FROM project_members WHERE project_id = $2)
         AND id NOT IN (SELECT person_id FROM team_members WHERE app_role = 'partner') ORDER BY id LIMIT 1`, [ownerId, projectId]);
    const say = (name: string) => `Ask ${name} to send the files by Monday`;
    const admin = (await resolveMe(db, ADMIN))!, me = (await resolveMe(db, asha))!;
    expect((await readSentence(db, admin, say(staff.display_name))).tasks[0].ownerId).toBe(staff.id); // the control: staff do match
    expect((await readSentence(db, me, say(staff.display_name))).tasks[0].ownerId).toBe(null);
    expect((await readSentence(db, me, say('Mona Other'))).tasks[0].ownerId).toBe(null);
    expect((await readSentence(db, me, say('Ravi Crux'))).tasks[0].ownerId).toBe(ravi);
  });
  it('gets back only what they typed when the model reads a staff name or address', async () => {
    const { readSentence } = await import('../lib/sentenceRead');
    const { rows: [staff] } = await db.query<{ display_name: string; email: string }>(
      `SELECT display_name, email FROM people WHERE active AND display_name LIKE '% %' AND id NOT IN (SELECT person_id FROM team_members WHERE app_role = 'partner') ORDER BY id LIMIT 1`);
    const first = staff.display_name.split(' ')[0];
    // A stand-in model that hands the masked sentence straight back as the title.
    const ask = async ({ user }: { user: string }) => JSON.stringify([{ title: /<said>\n([\s\S]*)\n<\/said>/.exec(user)![1] }]);
    const title = async (who: string, text: string) => (await readSentence(db, (await resolveMe(db, who))!, text, { ask })).tasks[0].title;
    expect(await title(ADMIN, `Send the files to ${first} today`)).toContain(staff.display_name); // the control: staff get the roster's spelling
    expect(await title(asha, `Send the files to ${first} today`)).not.toContain(staff.display_name);
    expect(await title(asha, `Send the files to ${staff.email} today`)).not.toContain(staff.display_name);
    expect(await title(asha, 'Send the files to Ravi today')).toContain('Ravi Crux');
    // The spelling must not tell a partner the name is on the roster: it comes back in the case they typed.
    expect(await title(asha, `Send the files to ${first.toLowerCase()} today`)).toContain(`to ${first.toLowerCase()} today`);
    expect(await title(asha, `Send the files to ${staff.email.toUpperCase()} today`)).toContain(staff.email.toUpperCase());
  });
  it('blocks a task only on someone from the same project', async () => {
    const { rows: [staff] } = await db.query<{ id: string }>(
      `SELECT id FROM people WHERE active AND id <> $1 AND id NOT IN (SELECT person_id FROM project_members WHERE project_id = $2)
         AND id NOT IN (SELECT person_id FROM team_members WHERE app_role = 'partner') ORDER BY id LIMIT 1`, [ownerId, projectId]);
    const t = await s.createTask(db, asha, { teamId: TEAM_ID, title: 'Wait for the brief', dueOn: '2026-10-20', projectId, ownerId: asha });
    expect(await code(s.blockTask(db, asha, t.id, { version: t.version, onId: staff.id, ask: 'Need the brief' }))).toBe('403');
    expect(await code(s.blockTask(db, asha, t.id, { version: t.version, onId: ownerId, ask: 'Need the brief' }))).toBe('ok');
  });
  it('cannot start a project, change Settings or add people', async () => {
    const p = await getProject(db, projectId);
    expect(await projectAccess(db, p, asha)).toBe('view');
    expect(await code(createProject(db, asha, TEAM_ID, { name: 'Partner own', kind: 'tasks', ownerId: asha, goal: '', workstreams: [], members: [] }))).toBe('403');
    expect(await code(addProjectPeople(db, asha, projectId, [{ personId: ADMIN, role: 'X' }]))).toBe('403');
    expect(await code(updateProject(db, asha, projectId, { name: 'Renamed', kind: 'tasks', ownerId: p.ownerId, goal: '', workstreams: [], members: [] }))).toBe('403');
  });
});

describe('the API a partner reaches', () => {
  it('reads Feedback and search as missing', async () => {
    process.env.NICO_SESSION_SECRET = process.env.NICO_SESSION_SECRET || 'partner-test-secret';
    state.jar = { [COOKIE]: signSession(asha) };
    const get = (url: string) => new Request(`http://localhost${url}`, { headers: { host: 'localhost' } });
    expect((await feedbackGet(get('/api/v1/feedback'), { params: Promise.resolve({}) } as never)).status).toBe(404);
    expect((await searchGet(get('/api/v1/search?q=a'), { params: Promise.resolve({}) } as never)).status).toBe(404);
    state.jar = { [COOKIE]: signSession(ADMIN) };
    expect((await feedbackGet(get('/api/v1/feedback'), { params: Promise.resolve({}) } as never)).status).toBe(200);
  });
});
