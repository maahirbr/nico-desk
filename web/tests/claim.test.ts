import { beforeAll, describe, expect, it, vi } from 'vitest';

// Claiming a placeholder row (28 Oct): someone added before their address was known signs in with their company
// Google account, and the one row whose full name matches theirs takes that address. Nothing else is ever claimed.

const state = vi.hoisted(() => ({ testDb: null as unknown }));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { checkSignIn } from '../lib/auth';
import { readProfile } from '../lib/google';
import { openDb, type Db } from '../lib/db';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';

const ADMIN = 'per_fay';
const CO = 'example.test'; // allowedDomain() in tests
let db: Db;

const add = (name: string, email: string) =>
  s.addPerson(db, ADMIN, TEAM_ID, { displayName: name, role: 'Designer', department: 'Design', email, appRoles: [] });
const emailOf = async (id: string) => (await db.query<{ email: string }>(`SELECT email FROM people WHERE id = $1`, [id])).rows[0].email;

beforeAll(async () => {
  db = await openDb();
  state.testDb = db;
});

describe('claiming a placeholder row by name', () => {
  it('lets a company account take the one matching placeholder, then signs in by address', async () => {
    const p = await add('Tara Quill', 'tara@pending.invalid');
    const got = await checkSignIn('tquill@example.test', { name: '  tara   QUILL ', hd: CO });
    expect(got).toEqual({ ok: true, personId: p.id });
    expect(await emailOf(p.id)).toBe('tquill@example.test');
    expect(await checkSignIn('tquill@example.test')).toEqual({ ok: true, personId: p.id });
  });

  it('needs the Workspace domain claim, not only the address', async () => {
    const p = await add('Ines Brook', 'ines@pending.invalid');
    expect(await checkSignIn('ines@example.test', { name: 'Ines Brook', hd: null })).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await checkSignIn('ines@example.test', { name: 'Ines Brook', hd: 'other.test' })).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await emailOf(p.id)).toBe('ines@pending.invalid');
  });

  it('never takes a row that already has a real address', async () => {
    const p = await add('Omar Vale', 'omar.vale@example.test');
    expect(await checkSignIn('omar2@example.test', { name: 'Omar Vale', hd: CO })).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await emailOf(p.id)).toBe('omar.vale@example.test');
  });

  it('refuses when anyone else shares the name', async () => {
    const a = await add('Lena Moss', 'lena@pending.invalid');
    await add('Lena Moss', 'lena.moss@example.test');
    expect(await checkSignIn('lmoss@example.test', { name: 'Lena Moss', hd: CO })).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await emailOf(a.id)).toBe('lena@pending.invalid');
  });

  it('refuses an inactive placeholder', async () => {
    const p = await add('Ravi Stone', 'ravi@pending.invalid');
    await db.query(`UPDATE people SET active = false WHERE id = $1`, [p.id]);
    expect(await checkSignIn('ravi@example.test', { name: 'Ravi Stone', hd: CO })).toMatchObject({ ok: false });
    expect(await emailOf(p.id)).toBe('ravi@pending.invalid');
  });

  it('never claims a lead or admin row, since a Google name can be edited', async () => {
    const p = await s.addPerson(db, ADMIN, TEAM_ID, { displayName: 'Kiran Holt', role: 'Lead', department: 'Design', email: 'kiran@pending.invalid', appRoles: ['lead'] });
    expect(await checkSignIn('kholt@example.test', { name: 'Kiran Holt', hd: CO })).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await emailOf(p.id)).toBe('kiran@pending.invalid');
  });

  it('matches the full name only, never a nickname', async () => {
    const p = await add('Maya Fern', 'maya@pending.invalid');
    await db.query(`UPDATE people SET nickname = 'Mayu' WHERE id = $1`, [p.id]);
    expect(await checkSignIn('mayu@example.test', { name: 'Mayu', hd: CO })).toMatchObject({ ok: false, code: 'not_allowed' });
    expect(await emailOf(p.id)).toBe('maya@pending.invalid');
  });

  it('names a personal account apart from a roster miss', async () => {
    expect(await checkSignIn('someone@gmail.com', { name: 'Tara Quill', hd: null })).toMatchObject({ ok: false, code: 'not_domain' });
  });
});

describe('readProfile', () => {
  const tok = (c: Record<string, unknown>) => `x.${Buffer.from(JSON.stringify(c)).toString('base64url')}.y`;
  it('reads the name and domain, falling back to given and family name', () => {
    expect(readProfile(tok({ name: 'Ada Lovelace', hd: 'Example.Test' }))).toEqual({ name: 'Ada Lovelace', hd: 'example.test' });
    expect(readProfile(tok({ given_name: 'Ada', family_name: 'Lovelace' }))).toEqual({ name: 'Ada Lovelace', hd: null });
    expect(readProfile('junk')).toEqual({ name: null, hd: null });
  });
});
