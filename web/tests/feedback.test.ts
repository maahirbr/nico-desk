import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Pilot feedback from inside the app (13 Oct): any signed-in person writes a note, everyone on the team reads it (14 Oct), only an admin marks it read,
// View as is refused, and the table comes to an older database through upgrade(). Real route handlers, signed sessions.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { COOKIE, VIEW_COOKIE, signSession, signView } from '../lib/auth';
import { openDb, upgrade, FEEDBACK_UPGRADE, type Db } from '../lib/db';
import { cleanPath, FEEDBACK_MAX } from '../lib/feedback';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { GET as listRoute, POST as sendRoute } from '../app/api/v1/feedback/route';
import { PATCH as readRoute } from '../app/api/v1/feedback/[id]/route';

const ADMIN = 'per_fay'; // fixtures: admin only
let db: Db;

beforeAll(() => { process.env.NICO_SESSION_SECRET = 'feedback-test-secret'; });
beforeEach(async () => {
  db = await openDb();
  state.testDb = db;
  state.jar = {};
});

const member = async () => {
  const p = (await s.listPeople(db, TEAM_ID)).find((x) => x.active && x.appRoles.length === 1 && x.appRoles[0] === 'member');
  if (!p) throw new Error('fixture has no plain member');
  return p;
};
const signIn = (id: string, view?: string) => { state.jar = { [COOKIE]: signSession(id), ...(view ? { [VIEW_COOKIE]: view } : {}) }; };
const req = (method: string, body?: unknown) =>
  new Request('http://localhost/api/v1/feedback', {
    method, headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
  });
const send = (body: unknown) => sendRoute(req('POST', body), { params: Promise.resolve({} as Record<string, never>) });
const list = () => listRoute(req('GET'), { params: Promise.resolve({} as Record<string, never>) });
const markRead = (id: string) => readRoute(req('PATCH'), { params: Promise.resolve({ id }) });
const count = async () => Number((await db.query<{ n: string }>('SELECT count(*) AS n FROM feedback')).rows[0].n);

describe('sending feedback', () => {
  it('lets any signed-in person send a note, with the page when they ticked the box', async () => {
    const m = await member();
    signIn(m.id);
    const res = await send({ body: '  The Team page is slow on my phone  ', path: '/team' });
    expect(res.status).toBe(200);
    const { rows } = await db.query<{ person_id: string; path: string; body: string; read_at: string | null }>('SELECT * FROM feedback');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ person_id: m.id, path: '/team', body: 'The Team page is slow on my phone', read_at: null });
  });

  it('keeps no page when the box was not ticked, and never a full address or a query string', async () => {
    signIn((await member()).id);
    await send({ body: 'no page', path: null });
    await send({ body: 'link', path: 'https://example.com/team?token=abc' });
    await send({ body: 'query', path: '/search?q=secret#x' });
    const { rows } = await db.query<{ body: string; path: string | null }>('SELECT body, path FROM feedback ORDER BY body');
    expect(Object.fromEntries(rows.map((r) => [r.body, r.path]))).toEqual({ 'no page': null, link: null, query: '/search' });
    expect(cleanPath('//evil.example/x')).toBeNull();
  });

  it('refuses a signed-out request', async () => {
    expect((await send({ body: 'hello' })).status).toBe(401);
    expect(await count()).toBe(0);
  });

  it('refuses an empty note, a blank note, an unknown field and a note over the limit, and takes one at the limit', async () => {
    signIn((await member()).id);
    expect((await send({ body: '' })).status).toBe(400);
    expect((await send({ body: '   \n ' })).status).toBe(400);
    expect((await send({ body: 'hi', extra: 1 })).status).toBe(400);
    const tooLong = await send({ body: 'x'.repeat(FEEDBACK_MAX + 1) });
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).error.message).toContain(String(FEEDBACK_MAX));
    expect(await count()).toBe(0);
    expect((await send({ body: 'x'.repeat(FEEDBACK_MAX) })).status).toBe(200);
    expect(await count()).toBe(1);
  });

  it('refuses a send while viewing as someone, and stores nothing', async () => {
    const m = await member();
    signIn(ADMIN, signView(ADMIN, m.id));
    const res = await send({ body: 'sent from a view' });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('viewing_as');
    expect(await count()).toBe(0);
  });
});

describe('reading feedback', () => {
  it('gives a member the whole team\'s list but not the mark read, and lists newest first with who and when', async () => {
    const m = await member();
    signIn(m.id);
    await send({ body: 'first', path: '/me' });
    await new Promise((r) => setTimeout(r, 5));
    await send({ body: 'second' });
    expect((await list()).status).toBe(200); // everyone on the team reads every note
    const id = (await db.query<{ id: string }>(`SELECT id FROM feedback WHERE body = 'first'`)).rows[0].id;
    expect((await markRead(id)).status).toBe(403);

    signIn(ADMIN);
    const out = await (await list()).json();
    expect(out.map((r: { body: string }) => r.body)).toEqual(['second', 'first']);
    expect(out[1]).toMatchObject({ personId: m.id, personName: m.displayName, path: '/me', readAt: null });
    expect(typeof out[1].createdAt).toBe('string');
  });

  it('lets an admin mark a note read, keeps the first read time on a second press, and 404s an unknown note', async () => {
    signIn((await member()).id);
    await send({ body: 'please read' });
    const id = (await db.query<{ id: string }>('SELECT id FROM feedback')).rows[0].id;
    signIn(ADMIN);
    const first = await (await markRead(id)).json();
    expect(first.readAt).toBeTruthy();
    const second = await (await markRead(id)).json();
    expect(second.readAt).toBe(first.readAt);
    expect((await (await list()).json())[0].readAt).toBe(first.readAt);
    expect((await markRead('fbk_missing')).status).toBe(404);
  });

  it('lets an admin viewing as a member read the list, and refuses the mark read', async () => {
    const m = await member();
    signIn(m.id);
    await send({ body: 'a note' });
    const id = (await db.query<{ id: string }>('SELECT id FROM feedback')).rows[0].id;
    signIn(ADMIN, signView(ADMIN, m.id));
    expect((await list()).status).toBe(200); // the view shows what a member sees: the list
    const res = await markRead(id);
    expect(res.status).toBe(403);
    expect((await db.query('SELECT 1 FROM feedback WHERE read_at IS NOT NULL')).rows).toHaveLength(0);
  });
});

describe('the upgrade', () => {
  it('adds the table with RLS on to an older database, and runs again safely', async () => {
    await db.exec('DROP TABLE feedback');
    await upgrade(db);
    await upgrade(db);
    await db.exec(FEEDBACK_UPGRADE);
    signIn((await member()).id);
    expect((await send({ body: 'after the upgrade' })).status).toBe(200);
    const { rows } = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE relname = 'feedback'`);
    expect(rows).toEqual([{ relrowsecurity: true }]);
  });

  it('is in the fresh schema with RLS on and the same columns', async () => {
    const { rows } = await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'feedback' ORDER BY ordinal_position`);
    expect(rows.map((r) => r.column_name)).toEqual(['id', 'person_id', 'path', 'body', 'created_at', 'read_at']);
    const rls = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE relname = 'feedback'`);
    expect(rls.rows[0].relrowsecurity).toBe(true);
  });
});
