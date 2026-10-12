import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// "View as": an admin reviews the site as another person, read-only. These tests cover the cookie, who may use
// it, and the guard every /api/v1 write goes through. Request cookies and the database are stubbed.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { VIEW_COOKIE, COOKIE, resolveMe, signSession, signView, verifyView } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { assertNotViewing, route } from '../lib/http';
import * as s from '../lib/service';
import { TEAM_ID } from '../lib/seed';
import { POST as createTaskRoute } from '../app/api/v1/tasks/route';
import { POST as viewPost, DELETE as viewDelete } from '../app/api/v1/session/view/route';

const ADMIN = 'per_fay'; // fixtures: admin only, not a lead
const LEAD = 'per_ada'; // fixtures: lead
let db: Db;

beforeAll(() => { process.env.NICO_SESSION_SECRET = 'view-as-test-secret'; });
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
const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, { method: 'POST', headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, body: JSON.stringify(body) });
const taskBody = (ownerId: string) => ({ title: 'Check the view', ownerId, dueOn: '2026-10-20' });
const eventCount = async () => (await db.query<{ n: string }>('SELECT count(*) AS n FROM events')).rows[0].n;

describe('the view cookie', () => {
  it('names the real person, the person viewed and an expiry, and only verifies for that real person', () => {
    const t = signView(ADMIN, LEAD);
    expect(verifyView(t, ADMIN)).toBe(LEAD);
    expect(verifyView(t, LEAD)).toBeNull(); // another session person's copy
    expect(verifyView(`${t}x`, ADMIN)).toBeNull(); // tampered signature
    expect(verifyView(t.replace(LEAD, 'per_bo'), ADMIN)).toBeNull(); // tampered target
    expect(verifyView(undefined, ADMIN)).toBeNull();
    expect(verifyView(signSession(ADMIN), ADMIN)).toBeNull(); // a session token cannot stand in for it
  });
});

describe('resolveMe', () => {
  it('lets an admin view as a lead: the effective person and roles switch, the real person stays', async () => {
    const me = await resolveMe(db, ADMIN, signView(ADMIN, LEAD));
    expect(me?.viewingAs).toBe(true);
    expect(me?.person.id).toBe(LEAD);
    expect(me?.person.appRoles).toContain('lead');
    expect(me?.person.appRoles).not.toContain('admin'); // the admin's powers do not leak into the view
    expect(me?.realPerson.id).toBe(ADMIN);
    expect(me?.realPerson.appRoles).toContain('admin');
  });

  it('shows a plain member exactly as a member (no lead or admin role)', async () => {
    const m = await member();
    const me = await resolveMe(db, ADMIN, signView(ADMIN, m.id));
    expect(me?.person.id).toBe(m.id);
    expect(me?.person.appRoles).toEqual(['member']);
  });

  it('restores the admin when the cookie is cleared, expired, or points at the admin', async () => {
    for (const token of [undefined, '', signView(ADMIN, ADMIN)]) {
      const me = await resolveMe(db, ADMIN, token);
      expect(me?.viewingAs).toBe(false);
      expect(me?.person.id).toBe(ADMIN);
      expect(me?.realPerson.id).toBe(ADMIN);
    }
  });

  it('ignores a forged cookie from a non-admin', async () => {
    const m = await member();
    const own = await resolveMe(db, m.id, signView(m.id, LEAD)); // properly signed, but the session person is no admin
    expect(own?.viewingAs).toBe(false);
    expect(own?.person.id).toBe(m.id);
    const lead = await resolveMe(db, LEAD, signView(ADMIN, LEAD)); // an admin's token used by someone else
    expect(lead?.viewingAs).toBe(false);
    expect(lead?.person.id).toBe(LEAD);
    const fake = await resolveMe(db, m.id, 'per_fay.per_ada.9999999999.AAAA'); // unsigned
    expect(fake?.viewingAs).toBe(false);
  });

  it('ignores a view of someone who is inactive or not on the roster', async () => {
    const m = await member();
    await db.query('UPDATE people SET active = false WHERE id = $1', [m.id]);
    expect((await resolveMe(db, ADMIN, signView(ADMIN, m.id)))?.viewingAs).toBe(false);
    expect((await resolveMe(db, ADMIN, signView(ADMIN, 'per_nobody')))?.viewingAs).toBe(false);
  });
});

describe('the read-only guard', () => {
  it('assertNotViewing throws 403 viewing_as only while viewing', async () => {
    const viewing = (await resolveMe(db, ADMIN, signView(ADMIN, LEAD)))!;
    expect(() => assertNotViewing(viewing)).toThrowError(expect.objectContaining({ status: 403, code: 'viewing_as' }));
    const own = (await resolveMe(db, ADMIN))!;
    expect(() => assertNotViewing(own)).not.toThrow();
  });

  it('refuses a write through route() while viewing, and records nothing', async () => {
    signIn(ADMIN, signView(ADMIN, LEAD));
    const before = await eventCount();
    const res = await createTaskRoute(post('/api/v1/tasks', taskBody(LEAD)), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('viewing_as');
    expect(await eventCount()).toBe(before);
  });

  it('refuses every non-GET method, but lets reads through', async () => {
    signIn(ADMIN, signView(ADMIN, LEAD));
    const h = route(async () => ({ ok: true }));
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      const res = await h(new Request('http://localhost/x', { method, headers: { origin: 'http://localhost', host: 'localhost' } }), { params: Promise.resolve({}) });
      expect(res.status, method).toBe(403);
    }
    const read = await h(new Request('http://localhost/x', { method: 'GET' }), { params: Promise.resolve({}) });
    expect(read.status).toBe(200);
  });

  it('lets the admin write once back in their own view', async () => {
    signIn(ADMIN);
    const res = await createTaskRoute(post('/api/v1/tasks', taskBody(LEAD)), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);
  });

  it('does not let a forged cookie turn a non-admin into a read-only viewer or an admin', async () => {
    const m = await member();
    signIn(m.id, signView(m.id, LEAD));
    const res = await createTaskRoute(post('/api/v1/tasks', taskBody(m.id)), { params: Promise.resolve({}) });
    expect(res.status).toBe(201); // the cookie is ignored: m acts as m
  });
});

describe('POST /api/v1/session/view', () => {
  it('sets a signed cookie for an admin, and the cookie then resolves to the viewed person', async () => {
    signIn(ADMIN);
    const res = await viewPost(post('/api/v1/session/view', { personId: LEAD }));
    expect(res.status).toBe(200);
    const set = res.headers.get('set-cookie') ?? '';
    expect(set).toContain(`${VIEW_COOKIE}=`);
    expect(set).toContain('HttpOnly');
    const token = set.split(';')[0].slice(`${VIEW_COOKIE}=`.length);
    expect(verifyView(token, ADMIN)).toBe(LEAD);
  });

  it('refuses a non-admin, a stranger and an inactive person', async () => {
    const m = await member();
    signIn(m.id);
    expect((await viewPost(post('/api/v1/session/view', { personId: LEAD }))).status).toBe(403);
    state.jar = {};
    expect((await viewPost(post('/api/v1/session/view', { personId: LEAD }))).status).toBe(401);
    signIn(ADMIN);
    expect((await viewPost(post('/api/v1/session/view', { personId: 'per_nobody' }))).status).toBe(404);
  });

  it('refuses a non-admin even while carrying a view cookie, and cannot be used from inside a view', async () => {
    signIn(ADMIN, signView(ADMIN, LEAD)); // while viewing as the lead, the real admin may still switch
    const res = await viewPost(post('/api/v1/session/view', { personId: (await member()).id }));
    expect(res.status).toBe(200);
    const m = await member();
    signIn(m.id, signView(m.id, LEAD));
    expect((await viewPost(post('/api/v1/session/view', { personId: LEAD }))).status).toBe(403);
  });

  it('choosing the admin themself, or DELETE, clears the cookie', async () => {
    signIn(ADMIN, signView(ADMIN, LEAD));
    const self = await viewPost(post('/api/v1/session/view', { personId: ADMIN }));
    expect(self.headers.get('set-cookie')).toMatch(new RegExp(`${VIEW_COOKIE}=;.*Max-Age=0`));
    const del = await viewDelete(new Request('http://localhost/api/v1/session/view', { method: 'DELETE', headers: { origin: 'http://localhost', host: 'localhost' } }));
    expect(del.status).toBe(204);
    expect(del.headers.get('set-cookie')).toMatch(new RegExp(`${VIEW_COOKIE}=;.*Max-Age=0`));
  });

  it('refuses a cross-site request', async () => {
    signIn(ADMIN);
    const bad = new Request('http://localhost/api/v1/session/view', { method: 'POST', headers: { origin: 'http://evil.test', host: 'localhost', 'content-type': 'application/json' }, body: JSON.stringify({ personId: LEAD }) });
    expect((await viewPost(bad)).status).toBe(403);
  });
});
