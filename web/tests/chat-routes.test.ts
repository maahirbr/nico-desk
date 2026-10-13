import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The chat API (app/api/v1/chat/): each call goes through route(), so the session, the same-origin check, View as and
// Zod all apply. The rules themselves are tested in tests/teamchat.test.ts; this file checks the doors.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { COOKIE, VIEW_COOKIE, signSession, signView } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { TEAM_ID } from '../lib/seed';
import { GET as rooms } from '../app/api/v1/chat/rooms/route';
import { GET as unread } from '../app/api/v1/chat/unread/route';
import { GET as list, POST as send } from '../app/api/v1/chat/rooms/[id]/messages/route';
import { POST as read } from '../app/api/v1/chat/rooms/[id]/read/route';
import { PATCH as edit, DELETE as remove } from '../app/api/v1/chat/messages/[id]/route';
import { POST as createTask } from '../app/api/v1/tasks/route';

const ADMIN = 'per_fay';
const LEAD = 'per_ada';
const DEE = 'per_dee';
const HIDDEN = 'prj_tiers';
const OPEN = 'prj_landing';
let db: Db;

beforeAll(() => { process.env.NICO_SESSION_SECRET = 'chat-routes-test-secret'; });
beforeEach(async () => {
  db = await openDb();
  state.testDb = db;
  state.jar = {};
  await db.query(`UPDATE people SET restricted = true WHERE id = $1`, [DEE]);
});

const signIn = (id: string, view?: string) => { state.jar = { [COOKIE]: signSession(id), ...(view ? { [VIEW_COOKIE]: view } : {}) }; };
const ctx = <P>(params: P) => ({ params: Promise.resolve(params) });
const req = (method: string, url: string, body?: unknown, origin = 'http://localhost') =>
  new Request(`http://localhost${url}`, {
    method, headers: { origin, host: 'localhost', ...(body === undefined ? {} : { 'content-type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body),
  });
const count = async () => Number((await db.query<{ n: string }>('SELECT count(*) AS n FROM chat_messages')).rows[0].n);
const say = async (room: string, body: string) => (await send(req('POST', `/api/v1/chat/rooms/${room}/messages`, { body }), ctx({ id: room }))).json();

describe('chat routes: the session and the origin', () => {
  it('answer 401 to someone who is not signed in', async () => {
    expect((await rooms(req('GET', '/api/v1/chat/rooms'), ctx({}))).status).toBe(401);
    expect((await unread(req('GET', '/api/v1/chat/unread'), ctx({}))).status).toBe(401);
    expect((await send(req('POST', '/api/v1/chat/rooms/x/messages', { body: 'hi' }), ctx({ id: TEAM_ID }))).status).toBe(401);
  });

  it('refuse a write from another origin and store nothing', async () => {
    signIn(LEAD);
    const before = await count();
    const res = await send(req('POST', `/api/v1/chat/rooms/${TEAM_ID}/messages`, { body: 'hi' }, 'http://elsewhere.example'), ctx({ id: TEAM_ID }));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(await count()).toBe(before);
  });
});

describe('chat routes: post, list, edit, delete, read', () => {
  it('post returns 201 with the message, list returns it last, and the unread count follows', async () => {
    signIn(LEAD);
    const res = await send(req('POST', `/api/v1/chat/rooms/${TEAM_ID}/messages`, { body: 'Standup moved to ten.' }), ctx({ id: TEAM_ID }));
    expect(res.status).toBe(201);
    const m = await res.json();
    expect(m.mine).toBe(true);
    const page = await (await list(req('GET', `/api/v1/chat/rooms/${TEAM_ID}/messages`), ctx({ id: TEAM_ID }))).json();
    expect(page.messages[page.messages.length - 1].id).toBe(m.id);
    signIn('per_cy');
    const n = await (await unread(req('GET', '/api/v1/chat/unread'), ctx({}))).json();
    expect(n.unread).toBeGreaterThan(0);
    const mark = await read(req('POST', `/api/v1/chat/rooms/${TEAM_ID}/read`, {}), ctx({ id: TEAM_ID }));
    expect(mark.status).toBe(204);
    const after = await (await rooms(req('GET', '/api/v1/chat/rooms'), ctx({}))).json();
    expect(after.rooms.find((r: { id: string }) => r.id === TEAM_ID).unread).toBe(0);
  });

  it('pages back with ?before=', async () => {
    signIn(LEAD);
    for (let i = 0; i < 4; i++) await say(TEAM_ID, `note ${i}`);
    const first = await (await list(req('GET', `/api/v1/chat/rooms/${TEAM_ID}/messages?limit=2`), ctx({ id: TEAM_ID }))).json();
    expect(first.messages).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const older = await (await list(req('GET', `/api/v1/chat/rooms/${TEAM_ID}/messages?limit=2&before=${first.messages[0].id}`), ctx({ id: TEAM_ID }))).json();
    expect(older.messages).toHaveLength(2);
    expect(older.messages.map((m: { id: string }) => m.id)).not.toContain(first.messages[0].id);
  });

  it('rejects a body that is too long, empty, or has an extra key', async () => {
    signIn(LEAD);
    const before = await count();
    const long = await send(req('POST', `/api/v1/chat/rooms/${TEAM_ID}/messages`, { body: 'a'.repeat(4301) }), ctx({ id: TEAM_ID }));
    const over = await send(req('POST', `/api/v1/chat/rooms/${TEAM_ID}/messages`, { body: 'a'.repeat(4100) }), ctx({ id: TEAM_ID }));
    const empty = await send(req('POST', `/api/v1/chat/rooms/${TEAM_ID}/messages`, { body: '   ' }), ctx({ id: TEAM_ID }));
    const extra = await send(req('POST', `/api/v1/chat/rooms/${TEAM_ID}/messages`, { body: 'hi', authorId: 'per_bo' }), ctx({ id: TEAM_ID }));
    for (const r of [long, over, empty, extra]) expect(r.status).toBe(400);
    expect(await count()).toBe(before);
  });

  it('lets only the author edit or delete, and a delete leaves a removed message', async () => {
    signIn(LEAD);
    const m = await say(TEAM_ID, 'First draft');
    signIn('per_cy');
    expect((await edit(req('PATCH', `/api/v1/chat/messages/${m.id}`, { body: 'Hijack' }), ctx({ id: m.id }))).status).toBe(403);
    expect((await remove(req('DELETE', `/api/v1/chat/messages/${m.id}`), ctx({ id: m.id }))).status).toBe(403);
    signIn(LEAD);
    const edited = await (await edit(req('PATCH', `/api/v1/chat/messages/${m.id}`, { body: 'Second draft' }), ctx({ id: m.id }))).json();
    expect(edited.editedAt).toBeTruthy();
    expect((await remove(req('DELETE', `/api/v1/chat/messages/${m.id}`), ctx({ id: m.id }))).status).toBe(204);
    const page = await (await list(req('GET', `/api/v1/chat/rooms/${TEAM_ID}/messages`), ctx({ id: TEAM_ID }))).json();
    const gone = page.messages.find((x: { id: string }) => x.id === m.id);
    expect(gone.deleted).toBe(true);
    expect(gone.parts).toEqual([]);
    expect(await count()).toBeGreaterThan(0); // the row stays: a delete is soft
  });
});

describe('chat routes: who may enter a room', () => {
  it('read a project room that the person cannot see as 404, for list, post and read', async () => {
    signIn(DEE);
    const before = await count();
    expect((await list(req('GET', `/api/v1/chat/rooms/${HIDDEN}/messages`), ctx({ id: HIDDEN }))).status).toBe(404);
    expect((await send(req('POST', `/api/v1/chat/rooms/${HIDDEN}/messages`, { body: 'hi' }), ctx({ id: HIDDEN }))).status).toBe(404);
    expect((await read(req('POST', `/api/v1/chat/rooms/${HIDDEN}/read`, {}), ctx({ id: HIDDEN }))).status).toBe(404);
    expect(await count()).toBe(before);
    const mine = await (await rooms(req('GET', '/api/v1/chat/rooms'), ctx({}))).json();
    expect(mine.rooms.map((r: { id: string }) => r.id)).not.toContain(HIDDEN);
  });

  it('read a room that does not exist as 404', async () => {
    signIn(LEAD);
    expect((await list(req('GET', '/api/v1/chat/rooms/prj_nowhere/messages'), ctx({ id: 'prj_nowhere' }))).status).toBe(404);
  });

  it('read a message in a hidden room as 404 for edit and delete', async () => {
    signIn(LEAD);
    const m = await say(HIDDEN, 'for the tiers group');
    signIn(DEE);
    expect((await edit(req('PATCH', `/api/v1/chat/messages/${m.id}`, { body: 'x' }), ctx({ id: m.id }))).status).toBe(404);
    expect((await remove(req('DELETE', `/api/v1/chat/messages/${m.id}`), ctx({ id: m.id }))).status).toBe(404);
  });
});

describe('chat routes: View as', () => {
  it('lets an admin read the viewed person\'s rooms but refuses every write, storing nothing', async () => {
    signIn(LEAD);
    const m = await say(TEAM_ID, 'Written by the lead');
    signIn(ADMIN, signView(ADMIN, LEAD));
    const before = await count();
    expect((await rooms(req('GET', '/api/v1/chat/rooms'), ctx({}))).status).toBe(200);
    expect((await list(req('GET', `/api/v1/chat/rooms/${TEAM_ID}/messages`), ctx({ id: TEAM_ID }))).status).toBe(200);
    const attempts = [
      await send(req('POST', `/api/v1/chat/rooms/${TEAM_ID}/messages`, { body: 'as the lead' }), ctx({ id: TEAM_ID })),
      await edit(req('PATCH', `/api/v1/chat/messages/${m.id}`, { body: 'changed' }), ctx({ id: m.id })),
      await remove(req('DELETE', `/api/v1/chat/messages/${m.id}`), ctx({ id: m.id })),
      await read(req('POST', `/api/v1/chat/rooms/${TEAM_ID}/read`, {}), ctx({ id: TEAM_ID })),
    ];
    for (const r of attempts) {
      expect(r.status).toBe(403);
      expect((await r.json()).error.code).toBe('viewing_as');
    }
    expect(await count()).toBe(before);
    const row = await db.query<{ deleted_at: string | null; edited_at: string | null }>('SELECT deleted_at, edited_at FROM chat_messages WHERE id = $1', [m.id]);
    expect(row.rows[0]).toEqual({ deleted_at: null, edited_at: null });
  });
});

describe('make a task from a message', () => {
  const taskBody = (extra: object) => ({ title: 'Book the venue', ownerId: LEAD, dueOn: '2026-10-20', ...extra });

  it('creates the task, links it back to the message, and shows it under the message', async () => {
    signIn(LEAD);
    const m = await say(OPEN, 'We still need to book the venue');
    const res = await createTask(req('POST', '/api/v1/tasks', taskBody({ fromMessage: m.id, projectId: OPEN })), ctx({}));
    expect(res.status).toBe(201);
    const task = await res.json();
    const page = await (await list(req('GET', `/api/v1/chat/rooms/${OPEN}/messages`), ctx({ id: OPEN }))).json();
    const shown = page.messages.find((x: { id: string }) => x.id === m.id);
    expect(shown.tasks.map((t: { id: string }) => t.id)).toContain(task.id);
  });

  it('creates nothing when the message is hidden from the person', async () => {
    signIn(LEAD);
    const m = await say(HIDDEN, 'Hidden from the restricted person');
    signIn(DEE);
    const tasks = async () => Number((await db.query<{ n: string }>('SELECT count(*) AS n FROM tasks')).rows[0].n);
    const before = await tasks();
    const res = await createTask(req('POST', '/api/v1/tasks', taskBody({ fromMessage: m.id, ownerId: DEE })), ctx({}));
    expect(res.status).toBe(404);
    expect(await tasks()).toBe(before);
  });
});
