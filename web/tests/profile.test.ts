import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The profile: names, an optional phone and a photo (Google's, or an uploaded 256px one). These tests cover the phone
// rule, what the photo upload accepts, who may fetch a photo, View as, and the in-place upgrade. Cookies and the
// database are stubbed, as in view-as.test.ts.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { COOKIE, VIEW_COOKIE, signSession, signView } from '../lib/auth';
import { openDb, upgrade, type Db } from '../lib/db';
import { readPicture } from '../lib/google';
import * as s from '../lib/service';
import { TEAM_ID } from '../lib/seed';
import { PUT as photoPut, DELETE as photoDelete } from '../app/api/v1/me/photo/route';
import { PATCH as profilePatch } from '../app/api/v1/me/profile/route';
import { GET as photoGet } from '../app/api/v1/people/[id]/photo/route';

const ME = 'per_bo';
const OTHER = 'per_cy'; // same team
const ADMIN = 'per_fay';
let db: Db;

beforeAll(() => { process.env.NICO_SESSION_SECRET = 'profile-test-secret'; });
beforeEach(async () => {
  db = await openDb();
  state.testDb = db;
  state.jar = {};
});

const signIn = (id: string, view?: string) => { state.jar = { [COOKIE]: signSession(id), ...(view ? { [VIEW_COOKIE]: view } : {}) }; };
const hdr = { origin: 'http://localhost', host: 'localhost' };
const code = async (r: Response) => (await r.json()).error?.code;

// The first bytes of each kind, padded. Enough for the magic-byte check, which is all the server reads.
const webp = (n = 64) => { const b = new Uint8Array(n); b.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0); b.set([...'WEBP'].map((c) => c.charCodeAt(0)), 8); return b; };
const jpeg = (n = 64) => { const b = new Uint8Array(n); b.set([0xff, 0xd8, 0xff, 0xe0], 0); return b; };
const png = (n = 64) => { const b = new Uint8Array(n); b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); return b; };
const put = (bytes: Uint8Array, type: string) =>
  photoPut(new Request('http://localhost/api/v1/me/photo', { method: 'PUT', headers: { ...hdr, 'content-type': type }, body: bytes as BodyInit }), { params: Promise.resolve({}) });
const patchPhone = (phone: string) =>
  profilePatch(new Request('http://localhost/api/v1/me/profile', { method: 'PATCH', headers: { ...hdr, 'content-type': 'application/json' }, body: JSON.stringify({ phone }) }), { params: Promise.resolve({}) });
const get = (id: string) =>
  photoGet(new Request(`http://localhost/api/v1/people/${id}/photo`, { headers: hdr }), { params: Promise.resolve({ id }) });
const patchProfile = (body: Record<string, string>) =>
  profilePatch(new Request('http://localhost/api/v1/me/profile', { method: 'PATCH', headers: { ...hdr, 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({}) });
const namesOf = async (id: string) => (await db.query<{ display_name: string; nickname: string | null }>(`SELECT display_name, nickname FROM people WHERE id = $1`, [id])).rows[0];
const phoneOf = async (id: string) => (await db.query<{ phone: string | null }>(`SELECT phone FROM people WHERE id = $1`, [id])).rows[0].phone;

describe('phone', () => {
  it('accepts 7 to 20 digits, spaces, + and -; an empty value clears it', () => {
    expect(s.checkPhone('+91 90000 00001')).toBe('+91 90000 00001');
    expect(s.checkPhone('  022-5550123 ')).toBe('022-5550123');
    expect(s.checkPhone('')).toBeNull();
    expect(s.checkPhone('   ')).toBeNull();
  });
  it('refuses letters, too short, too long and brackets', () => {
    for (const bad of ['call me', '12345', '1'.repeat(21), '(022) 555 0123', '+91 9000x 00001'])
      expect(() => s.checkPhone(bad), bad).toThrow();
  });
  it('is saved on your own profile, cleared by an empty value, and refused when invalid', async () => {
    signIn(ME);
    expect((await patchPhone('+91 90000 00009')).status).toBe(200);
    expect(await phoneOf(ME)).toBe('+91 90000 00009');
    const r = await patchPhone('not a number');
    expect(r.status).toBe(400);
    expect(await phoneOf(ME)).toBe('+91 90000 00009');
    expect((await patchPhone('')).status).toBe(200);
    expect(await phoneOf(ME)).toBeNull();
  });
  it('the database itself refuses a bad number', async () => {
    await expect(db.query(`UPDATE people SET phone = 'abc' WHERE id = $1`, [ME])).rejects.toThrow();
  });
  it('shows on a teammate page for the same team, with the team name and the photo flag', async () => {
    await s.setPhone(db, ME, '+91 90000 00009');
    const v = await s.personView(db, TEAM_ID, OTHER, ME);
    expect(v.phone).toBe('+91 90000 00009');
    expect(v.teamName).toBeTruthy();
    expect(v.hasPhoto).toBe(false);
  });
});

describe('names', () => {
  it('saves a name and a nickname; an empty nickname clears it', async () => {
    signIn(ME);
    const r = await patchProfile({ name: 'Bo Renamed', nickname: '  Bobo ' });
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ name: 'Bo Renamed', nickname: 'Bobo' });
    expect(await namesOf(ME)).toEqual({ display_name: 'Bo Renamed', nickname: 'Bobo' });
    expect((await patchProfile({ nickname: '' })).status).toBe(200);
    expect((await namesOf(ME)).nickname).toBeNull();
  });
  it('refuses a name under 2 characters and a nickname over 40, and writes nothing', async () => {
    signIn(ME);
    const before = await namesOf(ME);
    expect((await patchProfile({ name: 'B' })).status).toBe(400);
    expect((await patchProfile({ nickname: 'x'.repeat(41) })).status).toBe(400);
    expect(await namesOf(ME)).toEqual(before);
  });
  it('refuses a name or nickname someone else already uses, in any case or spacing', async () => {
    signIn(ME);
    const other = (await namesOf(OTHER)).display_name;
    const before = await namesOf(ME);
    for (const body of ([{ nickname: other.toUpperCase() }, { nickname: other.replace(" ", "  ") }, { name: other },
      { nickname: other.replace(" ", ".") }, { nickname: other.replace(" ", "") }, { nickname: `${other.split(' ')[0]} Two` }] as Record<string, string>[])) {
      const r = await patchProfile(body);
      expect(r.status, JSON.stringify(body)).toBe(400);
      expect(await code(r)).toBe('name_taken');
    }
    await s.setNames(db, OTHER, { nickname: 'Cee' });
    expect((await patchProfile({ nickname: 'cee' })).status).toBe(400);
    expect((await patchProfile({ nickname: 'Cée!' })).status).toBe(400); // accents and punctuation fold away
    expect((await patchProfile({ nickname: '...' })).status).toBe(400); // nothing to match on
    expect((await patchProfile({ nickname: other.split(' ')[0].toLowerCase() })).status).toBe(400); // their first name
    expect(await namesOf(ME)).toEqual(before);
    expect((await patchProfile({ nickname: before.display_name })).status).toBe(200); // your own name is fine
  });
  it('shows the nickname as the display name and keeps the roster name as the full name', async () => {
    const full = (await namesOf(ME)).display_name;
    await s.setNames(db, ME, { nickname: 'Bobo' });
    const v = await s.personView(db, TEAM_ID, OTHER, ME);
    expect(v.person.displayName).toBe('Bobo');
    expect(v.person.fullName).toBe(full);
    expect((await s.myProfile(db, ME)).nickname).toBe('Bobo');
  });
});

describe('photo upload', () => {
  it('stores a WebP, JPEG or PNG whose first bytes match its type', async () => {
    signIn(ME);
    for (const [bytes, type] of [[webp(), 'image/webp'], [jpeg(), 'image/jpeg'], [png(), 'image/png']] as const) {
      expect((await put(bytes, type)).status, type).toBe(200);
      const got = await s.getPhoto(db, TEAM_ID, ME);
      expect(got?.mime).toBe(type);
      expect(Array.from(got!.bytes)).toEqual(Array.from(bytes));
    }
  });
  it('refuses a photo over 200 KB with 413, and keeps the old one', async () => {
    signIn(ME);
    await put(webp(), 'image/webp');
    const r = await put(webp(200 * 1024 + 1), 'image/webp');
    expect(r.status).toBe(413);
    expect(await code(r)).toBe('photo_too_big');
    expect((await s.getPhoto(db, TEAM_ID, ME))?.bytes.length).toBe(64);
    expect((await put(webp(200 * 1024), 'image/webp')).status).toBe(200); // exactly the limit passes
  });
  it('refuses an oversized chunked body that sends no content-length, without reading it all', async () => {
    signIn(ME);
    let pulled = 0;
    const chunk = webp(64 * 1024);
    const body = new ReadableStream<Uint8Array>({
      pull(c) { pulled++; if (pulled > 50) c.close(); else c.enqueue(chunk); },
    });
    const req = new Request('http://localhost/api/v1/me/photo', { method: 'PUT', headers: { ...hdr, 'content-type': 'image/webp' }, body, duplex: 'half' } as RequestInit);
    const r = await photoPut(req, { params: Promise.resolve({}) });
    expect(r.status).toBe(413);
    expect(pulled).toBeLessThan(10);
  });
  it('refuses other types, a wrong claim and an empty body with 4xx', async () => {
    signIn(ME);
    const gif = new Uint8Array([...'GIF89a'].map((c) => c.charCodeAt(0)).concat(new Array(60).fill(0)));
    const r1 = await put(gif, 'image/gif');
    expect(r1.status).toBe(415);
    expect(await code(r1)).toBe('photo_type');
    expect((await put(jpeg(), 'image/webp')).status).toBe(415); // claims WebP, bytes are JPEG
    expect((await put(new TextEncoder().encode('<svg onload=alert(1)>'), 'image/png')).status).toBe(415);
    expect((await put(new Uint8Array(0), 'image/webp')).status).toBe(400);
    expect(await s.getPhoto(db, TEAM_ID, ME)).toBeNull();
  });
  it('is removed by DELETE', async () => {
    signIn(ME);
    await put(webp(), 'image/webp');
    const r = await photoDelete(new Request('http://localhost/api/v1/me/photo', { method: 'DELETE', headers: hdr }), { params: Promise.resolve({}) });
    expect(r.status).toBe(200);
    expect(await s.getPhoto(db, TEAM_ID, ME)).toBeNull();
  });
});

describe('who can fetch a photo', () => {
  beforeEach(async () => {
    signIn(ME);
    await put(webp(), 'image/webp');
  });
  it('sends it to a signed-in teammate, private, with an ETag; the same ETag gives 304', async () => {
    signIn(OTHER);
    const r = await get(ME);
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('image/webp');
    expect(r.headers.get('cache-control')).toMatch(/^private/);
    const etag = r.headers.get('etag')!;
    expect(etag).toBeTruthy();
    const again = await photoGet(new Request('http://localhost/api/v1/people/x/photo', { headers: { ...hdr, 'if-none-match': etag } }), { params: Promise.resolve({ id: ME }) });
    expect(again.status).toBe(304);
  });
  it('refuses someone who is not signed in', async () => {
    state.jar = {};
    expect((await get(ME)).status).toBe(401);
  });
  it('refuses a signed-in person on another team', async () => {
    await db.query(`INSERT INTO teams VALUES ('team_other', 'Other team', 'run')`);
    await db.query(`INSERT INTO people (id, display_name, role, department, email) VALUES ('per_out', 'Out Sider', 'x', 'x', 'out@example.test')`);
    await db.query(`INSERT INTO team_members VALUES ('team_other', 'per_out', 'member')`);
    signIn('per_out');
    expect((await get(ME)).status).toBe(404);
    expect(await s.getPhoto(db, 'team_other', ME)).toBeNull();
  });
  it('says 404 when the person has no uploaded photo', async () => {
    signIn(OTHER);
    expect((await get(ADMIN)).status).toBe(404);
  });
});

describe('the photo map the avatars read', () => {
  it('prefers an upload over the Google address, and leaves out people with neither', async () => {
    await db.query(`UPDATE people SET photo_url = 'https://lh3.googleusercontent.com/a/x' WHERE id = $1`, [OTHER]);
    await db.query(`UPDATE people SET photo_url = 'https://lh3.googleusercontent.com/a/y' WHERE id = $1`, [ME]);
    signIn(ME);
    await put(webp(), 'image/webp');
    const map = await s.teamPhotos(db, TEAM_ID);
    expect(map[ME].v).toBeTypeOf('number');
    expect(map[ME].url).toBeUndefined();
    expect(map[OTHER]).toEqual({ url: 'https://lh3.googleusercontent.com/a/x' });
    expect(map[ADMIN]).toBeUndefined();
  });
});

describe('View as', () => {
  it('refuses a photo upload, a photo delete and a phone change, and writes nothing', async () => {
    const phoneBefore = await phoneOf(ME); // the fixtures give this person a synthetic number
    signIn(ADMIN, signView(ADMIN, ME));
    const up = await put(webp(), 'image/webp');
    expect(up.status).toBe(403);
    expect(await code(up)).toBe('viewing_as');
    const del = await photoDelete(new Request('http://localhost/api/v1/me/photo', { method: 'DELETE', headers: hdr }), { params: Promise.resolve({}) });
    expect(del.status).toBe(403);
    const ph = await patchPhone('+91 90000 00009');
    expect(ph.status).toBe(403);
    const before = await namesOf(ME);
    expect((await patchProfile({ nickname: 'Viewer' })).status).toBe(403);
    expect(await namesOf(ME)).toEqual(before);
    expect(await phoneOf(ME)).toBe(phoneBefore);
    expect(await phoneOf(ADMIN)).toBeNull();
    expect(await s.getPhoto(db, TEAM_ID, ME)).toBeNull();
    expect(await s.getPhoto(db, TEAM_ID, ADMIN)).toBeNull();
  });
});

describe('Google photo address', () => {
  const jwt = (c: Record<string, unknown>) => `x.${Buffer.from(JSON.stringify(c)).toString('base64url')}.y`;
  it('keeps an https address and drops anything else', () => {
    expect(readPicture(jwt({ picture: 'https://lh3.googleusercontent.com/a/abc=s96-c' }))).toBe('https://lh3.googleusercontent.com/a/abc=s96-c');
    expect(readPicture(jwt({ picture: 'http://lh3.googleusercontent.com/a/abc' }))).toBeNull();
    expect(readPicture(jwt({ picture: 'javascript:alert(1)' }))).toBeNull();
    expect(readPicture(jwt({ picture: 42 }))).toBeNull();
    expect(readPicture(jwt({}))).toBeNull();
    expect(readPicture('junk')).toBeNull();
  });
});

describe('the upgrade', () => {
  it('adds the profile columns and photo table to an older database, can run again, and keeps data', async () => {
    await db.exec(`DROP TABLE person_photos; ALTER TABLE people DROP COLUMN photo_url; ALTER TABLE people DROP COLUMN phone; ALTER TABLE people DROP COLUMN nickname;`);
    const before = (await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM people`)).rows[0].n;
    await upgrade(db);
    await upgrade(db);
    expect((await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM people`)).rows[0].n).toBe(before);
    const cols = (await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'people' AND column_name IN ('photo_url','phone','nickname')`)).rows;
    expect(cols.map((c) => c.column_name).sort()).toEqual(['nickname', 'phone', 'photo_url']);
    await expect(db.query(`UPDATE people SET phone = 'abc' WHERE id = $1`, [ME])).rejects.toThrow();
    await s.setPhone(db, ME, '+91 90000 00009');
    signIn(ME);
    expect((await put(webp(), 'image/webp')).status).toBe(200);
  });
  it('turns row level security on for the photo table', async () => {
    const r = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE relname = 'person_photos'`);
    expect(r.rows[0].relrowsecurity).toBe(true);
  });
});
