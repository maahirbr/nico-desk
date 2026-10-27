import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Google Meet as a source of minutes (13 Oct). Google is never called: fetch is faked in every test, and every
// person, address, token and meeting here is made up.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { VIEW_COOKIE, COOKIE, signSession, signView } from '../lib/auth';
import { openDb, upgrade, type Db } from '../lib/db';
import {
  checkState, disconnectMeet, docIdOf, docToText, listMeetMeetings, meetAuthUrl, meetEnabled, newNonce, notesToMinutes, openToken, readMeetMeeting, saveLink, sealToken,
  signState, transcriptToText,
} from '../lib/meet';
import { nextStepsOf, plainParse } from '../lib/planUtil';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { GET as callbackGet } from '../app/api/auth/google/meet/callback/route';
import { DELETE as meetDelete, GET as meetGet, POST as meetPost } from '../app/api/v1/connections/google-meet/route';
import { GET as meetingsGet } from '../app/api/v1/connections/google-meet/meetings/route';
import { GET as meetingGet } from '../app/api/v1/connections/google-meet/meetings/[id]/route';
import { POST as docPost } from '../app/api/v1/connections/google-meet/docs/route';
import { Connections } from '../components/Connections';
import { ImportPanel } from '../components/Minutes';

const ADMIN = 'per_fay'; // fixtures: admin only
const LEAD = 'per_ada'; // fixtures: lead
const CLIENT = 'test-client.apps.googleusercontent.com';
const REFRESH = 'rt-test-refresh-token-1234567890';
const ACCESS = 'at-test-access-token-abcdef';
const SCOPES = ['https://www.googleapis.com/auth/meetings.space.readonly', 'https://www.googleapis.com/auth/drive.meet.readonly', 'https://www.googleapis.com/auth/documents.readonly'];
let db: Db;
let leadEmail: string;

const ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NICO_MEET', 'NICO_TOKEN_KEY', 'VERCEL', 'DATABASE_URL'];
beforeAll(() => { process.env.NICO_SESSION_SECRET = 'meet-test-session-secret'; });
beforeEach(async () => {
  db = await openDb();
  state.testDb = db;
  state.jar = {};
  (globalThis as { __ndRate?: Map<string, unknown> }).__ndRate?.clear(); // the callback allows 10 returns a minute per address
  process.env.GOOGLE_CLIENT_ID = CLIENT;
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.NICO_MEET = '1';
  process.env.NICO_TOKEN_KEY = 'meet-test-token-key';
  leadEmail = (await s.listPeople(db, TEAM_ID)).find((p) => p.id === LEAD)!.email;
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV) delete process.env[k];
});

const member = async () => (await s.listPeople(db, TEAM_ID)).find((x) => x.active && x.appRoles.length === 1 && x.appRoles[0] === 'member')!;
const signIn = (id: string, view?: string) => { state.jar = { [COOKIE]: signSession(id), ...(view ? { [VIEW_COOKIE]: view } : {}) }; };
const post = (url: string) => new Request(`http://localhost${url}`, { method: 'POST', headers: { origin: 'http://localhost', host: 'localhost' } });
const del = (url: string) => new Request(`http://localhost${url}`, { method: 'DELETE', headers: { origin: 'http://localhost', host: 'localhost' } });
const get = (url: string) => new Request(`http://localhost${url}`, { headers: { host: 'localhost' } });
const none = { params: Promise.resolve({}) };
const status = async (p: Promise<Response> | Response) => (await p).status;
const code = async (p: Promise<Response> | Response) => (await (await p).json()).error?.code;

const json = (body: unknown, st = 200) => new Response(JSON.stringify(body), { status: st, headers: { 'content-type': 'application/json' } });
const idToken = (email: string, over: Record<string, unknown> = {}) => {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none' })}.${part({ iss: 'https://accounts.google.com', aud: CLIENT, exp: Math.floor(Date.now() / 1000) + 600, email_verified: true, email, ...over })}.sig`;
};

type Call = { url: string; method: string; auth: string; body: string };
// A fake Google. `routes` maps a URL prefix to a reply; the token endpoint answers by grant type.
function fakeGoogle(opts: { email?: string; scope?: string; refresh?: string | null; routes?: Record<string, () => Response> } = {}) {
  const calls: Call[] = [];
  const fn = vi.fn(async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ url, method: init.method ?? 'GET', auth: headers.Authorization ?? '', body: init.body ? String(init.body) : '' });
    if (url === 'https://oauth2.googleapis.com/token') {
      const grant = new URLSearchParams(String(init.body)).get('grant_type');
      if (grant === 'refresh_token') return json({ access_token: ACCESS, expires_in: 3600 });
      return json({
        ...(opts.refresh === null ? {} : { refresh_token: opts.refresh ?? REFRESH }), access_token: ACCESS,
        id_token: idToken(opts.email ?? leadEmail), scope: opts.scope ?? ['openid', 'email', ...SCOPES].join(' '),
      });
    }
    if (url === 'https://oauth2.googleapis.com/revoke') return new Response('{}', { status: 200 });
    for (const [prefix, reply] of Object.entries(opts.routes ?? {})) if (url.startsWith(prefix)) return reply();
    return json({ error: { code: 404 } }, 404);
  });
  vi.stubGlobal('fetch', fn);
  return { calls, fn };
}

// Runs the real start route, and returns what Google would send back to the callback.
async function start(personId = LEAD) {
  signIn(personId);
  const res = await meetPost(post('/api/v1/connections/google-meet'), none);
  const { url } = await res.json();
  const nonce = /nd_meet_state=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')![1];
  return { res, url: new URL(url), state: new URL(url).searchParams.get('state')!, nonce };
}
const callback = (params: Record<string, string>, nonce?: string) =>
  callbackGet(new Request(`http://localhost/api/auth/google/meet/callback?${new URLSearchParams(params)}`, { headers: nonce ? { cookie: `nd_meet_state=${nonce}` } : {} }));
const where = (res: Response) => new URL(res.headers.get('location')!).search;
const link = async (personId = LEAD) => (await db.query<{ email: string; scopes: string[]; refresh_enc: string }>(`SELECT * FROM google_links WHERE person_id = $1`, [personId])).rows[0];

describe('the switch', () => {
  it('is off by default: every route answers 404 and nothing is stored', async () => {
    delete process.env.NICO_MEET;
    expect(meetEnabled()).toBe(false);
    signIn(LEAD);
    expect(await status(meetGet(get('/api/v1/connections/google-meet'), none))).toBe(404);
    expect(await status(meetPost(post('/api/v1/connections/google-meet'), none))).toBe(404);
    expect(await status(meetDelete(del('/api/v1/connections/google-meet'), none))).toBe(404);
    expect(await status(meetingsGet(get('/api/v1/connections/google-meet/meetings'), none))).toBe(404);
    expect(await status(meetingGet(get('/api/v1/connections/google-meet/meetings/x'), { params: Promise.resolve({ id: 'x' }) }))).toBe(404);
    expect(await status(callbackGet(new Request('http://localhost/api/auth/google/meet/callback?code=a&state=b')))).toBe(404);
  });

  it('needs the client id and secret as well', () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(meetEnabled()).toBe(false);
  });

  it('stays off on a hosted server without its own token key', () => {
    process.env.VERCEL = '1';
    delete process.env.NICO_TOKEN_KEY;
    expect(meetEnabled()).toBe(false);
    process.env.NICO_TOKEN_KEY = 'meet-test-token-key';
    expect(meetEnabled()).toBe(true);
  });

  it('shows no Google Meet in the pages unless it is on', () => {
    const status = { granola: { connected: false, hint: null, savedAt: null, source: null, envVar: 'G' }, fireflies: { connected: false, hint: null, savedAt: null, source: null, envVar: 'F' }, fathom: { connected: false, hint: null, savedAt: null, source: null, envVar: 'T' } };
    const off = renderToStaticMarkup(createElement(Connections, { status, canManage: true }));
    expect(off).not.toContain('Google Meet');
    const on = renderToStaticMarkup(createElement(Connections, { status, canManage: true, meet: { connected: false, email: null, since: null } }));
    expect(on).toContain('Connect Google Meet');
    const connected = renderToStaticMarkup(createElement(Connections, { status, canManage: true, meet: { connected: true, email: 'x@example.test', since: null } }));
    expect(connected).toContain('Disconnect');
    // The Minutes tab appears only after the status call says connected, so a first render never has it.
    const panel = renderToStaticMarkup(createElement(ImportPanel, { what: 'plan', busy: false, today: '2026-10-09', onRead: () => {} }));
    expect(panel).not.toContain('Google Meet');
    expect(panel).not.toContain('Google Doc');
  });
});

describe('connecting', () => {
  it('refuses a member, and allows a lead and an admin', async () => {
    signIn((await member()).id);
    expect(await status(meetPost(post('/api/v1/connections/google-meet'), none))).toBe(403);
    expect(await status(meetDelete(del('/api/v1/connections/google-meet'), none))).toBe(403);
    expect((await start(LEAD)).res.status).toBe(200);
    expect((await start(ADMIN)).res.status).toBe(200);
  });

  it('asks Google only for the Meet read scopes, offline, with the earlier grants kept, and never at sign-in', async () => {
    const { url, res } = await start(LEAD);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const q = url.searchParams;
    expect(q.get('scope')!.split(' ').sort()).toEqual(['email', 'openid', ...SCOPES].sort());
    expect(q.get('access_type')).toBe('offline');
    expect(q.get('include_granted_scopes')).toBe('true');
    expect(q.get('prompt')).toBe('consent');
    expect(q.get('client_id')).toBe(CLIENT);
    expect(q.get('redirect_uri')).toBe('http://localhost/api/auth/google/meet/callback');
    expect(q.get('login_hint')).toBeNull(); // no address goes into the URL
    expect(res.headers.get('set-cookie')).toMatch(/nd_meet_state=.+HttpOnly.+SameSite=Lax/);
    const { authUrl } = await import('../lib/google');
    expect(authUrl('http://localhost/cb', 'x')).not.toContain('meetings.space');
    expect(authUrl('http://localhost/cb', 'x')).not.toContain('drive');
  });

  it('refuses View as: an admin viewing as a lead cannot start, read or disconnect', async () => {
    signIn(ADMIN, signView(ADMIN, LEAD));
    expect(await code(meetPost(post('/api/v1/connections/google-meet'), none))).toBe('viewing_as');
    expect(await code(meetDelete(del('/api/v1/connections/google-meet'), none))).toBe('viewing_as');
    expect(await code(meetGet(get('/api/v1/connections/google-meet'), none))).toBe('viewing_as');
    expect(await code(meetingsGet(get('/api/v1/connections/google-meet/meetings'), none))).toBe('viewing_as');
    expect(await code(meetingGet(get('/api/v1/connections/google-meet/meetings/abc'), { params: Promise.resolve({ id: 'abc' }) }))).toBe('viewing_as');
  });

  it('saves the link on a good return, and the refresh token is encrypted in the row', async () => {
    const { state: st, nonce } = await start(LEAD);
    const g = fakeGoogle();
    const res = await callback({ code: 'auth-code', state: st }, nonce);
    expect(res.status).toBe(302);
    expect(where(res)).toBe('?meet=connected');
    const row = await link();
    expect(row.email).toBe(leadEmail.toLowerCase());
    expect(row.scopes).toEqual(expect.arrayContaining(SCOPES));
    expect(row.refresh_enc).not.toContain(REFRESH);
    expect(JSON.stringify(row)).not.toContain(REFRESH);
    expect(openToken(row.refresh_enc, LEAD)).toBe(REFRESH);
    expect(() => openToken(row.refresh_enc, ADMIN)).toThrow(); // bound to the person it belongs to
    expect(() => openToken(row.refresh_enc.slice(0, -2) + 'AA', LEAD)).toThrow(); // tampering is caught
    expect(g.calls.some((c) => c.url.includes('/token'))).toBe(true);
    expect(res.headers.get('location')).not.toContain(REFRESH);
    expect(res.headers.get('location')).not.toContain('auth-code');
  });

  it('seals each token with its own random value', () => {
    expect(sealToken('same', LEAD)).not.toBe(sealToken('same', LEAD));
    expect(openToken(sealToken('same', LEAD), LEAD)).toBe('same');
  });

  it('refuses when the Google account is not the lead\'s own address', async () => {
    const { state: st, nonce } = await start(LEAD);
    fakeGoogle({ email: 'someone.else@example.test' });
    const res = await callback({ code: 'auth-code', state: st }, nonce);
    expect(where(res)).toBe('?meet=mismatch');
    expect(await link()).toBeUndefined();
  });

  it('accepts a second address listed on the person', async () => {
    await db.query(`UPDATE people SET alt_emails = ARRAY['lead.partner@example.test'] WHERE id = $1`, [LEAD]);
    const { state: st, nonce } = await start(LEAD);
    fakeGoogle({ email: 'Lead.Partner@example.test' });
    expect(where(await callback({ code: 'c', state: st }, nonce))).toBe('?meet=connected');
    expect((await link()).email).toBe('lead.partner@example.test');
  });

  it('refuses a return with a bad, missing, or another person\'s state, and never calls Google', async () => {
    const { state: st, nonce } = await start(LEAD);
    const g = fakeGoogle();
    expect(where(await callback({ code: 'c', state: `${st}x` }, nonce))).toBe('?meet=state'); // tampered
    expect(where(await callback({ code: 'c', state: st }))).toBe('?meet=state'); // no cookie: another browser
    expect(where(await callback({ code: 'c', state: st }, newNonce()))).toBe('?meet=state'); // wrong cookie
    expect(where(await callback({ code: 'c' }, nonce))).toBe('?meet=state'); // no state
    signIn(ADMIN); // the state names the lead, so the admin's session cannot finish it
    expect(where(await callback({ code: 'c', state: st }, nonce))).toBe('?meet=state');
    expect(g.fn).not.toHaveBeenCalled();
    expect(await link()).toBeUndefined();
  });

  it('refuses View as, a member, a cancelled screen, a missing refresh token and a missing scope', async () => {
    const g = fakeGoogle();
    const ok = await start(LEAD);
    signIn(ADMIN, signView(ADMIN, LEAD));
    expect(where(await callback({ code: 'c', state: ok.state }, ok.nonce))).toBe('?meet=viewing_as');
    expect(g.fn).not.toHaveBeenCalled();
    const m = await member();
    signIn(m.id);
    expect(where(await callback({ code: 'c', state: ok.state }, ok.nonce))).toBe('?meet=not_allowed');
    signIn(LEAD);
    expect(where(await callback({ error: 'access_denied', state: ok.state }, ok.nonce))).toBe('?meet=cancelled');
    fakeGoogle({ refresh: null });
    expect(where(await callback({ code: 'c', state: ok.state }, ok.nonce))).toBe('?meet=no_refresh');
    fakeGoogle({ scope: `openid email ${SCOPES[0]}` }); // the person unticked the Drive permission
    expect(where(await callback({ code: 'c', state: ok.state }, ok.nonce))).toBe('?meet=scopes');
    expect(await link()).toBeUndefined();
  });

  it('redirects a signed-out visitor to sign-in', async () => {
    state.jar = {};
    const res = await callback({ code: 'c', state: 's' }, 'n');
    expect(res.headers.get('location')).toBe('http://localhost/signin');
  });
});

describe('state', () => {
  const now = Date.parse('2026-10-09T10:00:00Z');
  it('is signed, bound to the person and the browser, and expires after ten minutes', () => {
    const st = signState(LEAD, 'nonce-1', now);
    expect(checkState(st, LEAD, 'nonce-1', now + 9 * 60_000)).toBe(true);
    expect(checkState(st, LEAD, 'nonce-1', now + 11 * 60_000)).toBe(false); // expired
    expect(checkState(st, ADMIN, 'nonce-1', now)).toBe(false); // another person
    expect(checkState(st, LEAD, 'nonce-2', now)).toBe(false); // another browser
    expect(checkState(st, LEAD, '', now)).toBe(false);
    expect(checkState(`${st}0`, LEAD, 'nonce-1', now)).toBe(false); // signature changed
    const [payload, sig] = st.split('.');
    const forged = Buffer.from(JSON.stringify({ p: ADMIN, n: 'nonce-1', e: now + 600_000 })).toString('base64url');
    expect(checkState(`${forged}.${sig}`, ADMIN, 'nonce-1', now)).toBe(false); // payload changed under the same signature
    expect(payload).toBeTruthy();
    expect(checkState('', LEAD, 'nonce-1', now)).toBe(false);
    expect(checkState('garbage', LEAD, 'nonce-1', now)).toBe(false);
  });

  it('cannot be checked with another key', () => {
    const st = signState(LEAD, 'n', now);
    process.env.NICO_TOKEN_KEY = 'a-different-key';
    expect(checkState(st, LEAD, 'n', now)).toBe(false);
  });
});

describe('disconnecting', () => {
  it('deletes the row and tells Google to revoke the token', async () => {
    await saveLink(db, LEAD, { refreshToken: REFRESH, email: leadEmail, scopes: SCOPES });
    const g = fakeGoogle();
    signIn(LEAD);
    const res = await meetDelete(del('/api/v1/connections/google-meet'), none);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ connected: false });
    expect(await link()).toBeUndefined();
    const revoke = g.calls.find((c) => c.url === 'https://oauth2.googleapis.com/revoke')!;
    expect(revoke.method).toBe('POST');
    expect(new URLSearchParams(revoke.body).get('token')).toBe(REFRESH);
  });

  it('still deletes the row when Google cannot be reached', async () => {
    await saveLink(db, LEAD, { refreshToken: REFRESH, email: leadEmail, scopes: SCOPES });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    await disconnectMeet(db, LEAD);
    expect(await link()).toBeUndefined();
  });

  it('is quiet when there is nothing to disconnect', async () => {
    const g = fakeGoogle();
    await disconnectMeet(db, LEAD);
    expect(g.fn).not.toHaveBeenCalled();
  });
});

const REC = 'conferenceRecords/rec-1';
const NOTES_DOC = [
  'Weekly working session', 'Oct 8, 2026', '',
  'Summary', 'The team agreed the sale plan.', '',
  'Suggested next steps',
  '[Kabir Sethi] Send the studio the column list by Oct 12, 2026',
  '[Priya Rao] Book the courier for Friday', '',
].join('\n');
const record = () => json({ name: REC, startTime: '2026-10-08T05:30:00Z', endTime: '2026-10-08T06:10:00Z', space: 'spaces/sp-1' });
const space = () => json({ name: 'spaces/sp-1', meetingCode: 'abc-mnop-xyz', meetingUri: 'https://meet.example.test/abc-mnop-xyz' });
const transcriptRoutes = {
  [`https://meet.googleapis.com/v2/${REC}/transcripts/t-1/entries`]: () => json({ transcriptEntries: [
    { name: `${REC}/transcripts/t-1/entries/e1`, participant: `${REC}/participants/p1`, text: 'Let us start with the sale.', startTime: '2026-10-08T05:31:00Z' },
    { name: `${REC}/transcripts/t-1/entries/e2`, participant: `${REC}/participants/p1`, text: 'Kabir will send the column list.' },
    { name: `${REC}/transcripts/t-1/entries/e3`, participant: `${REC}/participants/p2`, text: 'I will book the courier.' },
    { name: `${REC}/transcripts/t-1/entries/e4`, participant: `${REC}/participants/p9`, text: 'Thanks all.' },
  ] }),
  [`https://meet.googleapis.com/v2/${REC}/transcripts?`]: () => json({ transcripts: [{ name: `${REC}/transcripts/t-1`, state: 'FILE_GENERATED', docsDestination: { document: 'doc-tr-1' } }] }),
  [`https://meet.googleapis.com/v2/${REC}/participants`]: () => json({ participants: [
    { name: `${REC}/participants/p1`, signedinUser: { user: 'users/1', displayName: 'Kabir Sethi' } },
    { name: `${REC}/participants/p2`, anonymousUser: { displayName: 'Priya Rao' } },
  ] }),
};
const base = {
  [`https://meet.googleapis.com/v2/${REC}/smartNotes`]: () => json({ smartNotes: [{ name: `${REC}/smartNotes/n-1`, state: 'FILE_GENERATED', docsDestination: { document: 'doc-notes-1' } }] }),
  'https://www.googleapis.com/drive/v3/files/doc-notes-1/export': () => new Response(NOTES_DOC, { status: 200 }),
  [`https://meet.googleapis.com/v2/${REC}?`]: record, [`https://meet.googleapis.com/v2/${REC}`]: record,
  'https://meet.googleapis.com/v2/spaces/sp-1': space,
};

describe('listing and reading', () => {
  beforeEach(async () => { await saveLink(db, LEAD, { refreshToken: REFRESH, email: leadEmail, scopes: SCOPES }); });

  it('lists the last 14 days with a date and the meeting code as the title', async () => {
    const g = fakeGoogle({ routes: {
      'https://meet.googleapis.com/v2/conferenceRecords?': () => json({ conferenceRecords: [{ name: REC, startTime: '2026-10-08T20:00:00Z', space: 'spaces/sp-1' }, { name: 'conferenceRecords/rec-2', startTime: '2026-10-07T05:00:00Z', space: 'spaces/sp-2' }] }),
      'https://meet.googleapis.com/v2/spaces/sp-1': space,
    } });
    const rows = await listMeetMeetings(db, LEAD, { days: 14 });
    expect(rows).toEqual([
      { id: 'rec-1', title: 'Meeting abc-mnop-xyz', date: '2026-10-09', attendees: [] }, // 20:00 UTC is already the 9th in IST
      { id: 'rec-2', title: 'Google Meet meeting', date: '2026-10-07', attendees: [] }, // its space could not be read: the title stays plain
    ]);
    const list = g.calls.find((c) => c.url.startsWith('https://meet.googleapis.com/v2/conferenceRecords?'))!;
    const filter = new URL(list.url).searchParams.get('filter')!;
    const since = Date.parse(/"(.+)"/.exec(filter)![1]);
    expect(Math.abs(Date.now() - since - 14 * 86400000)).toBeLessThan(60_000);
    expect(list.auth).toBe(`Bearer ${ACCESS}`);
    const refresh = g.calls.find((c) => c.url.includes('/token'))!;
    expect(new URLSearchParams(refresh.body).get('refresh_token')).toBe(REFRESH);
    expect((await link()).refresh_enc).not.toContain(REFRESH);
  });

  it('maps the notes Doc into minutes that the existing reader turns into steps with owners', async () => {
    const g = fakeGoogle({ routes: base });
    const note = await readMeetMeeting(db, LEAD, 'rec-1');
    expect(note).toMatchObject({ id: 'rec-1', title: 'Meeting abc-mnop-xyz', date: '2026-10-08', kind: 'notes', link: 'https://docs.google.com/document/d/doc-notes-1/edit' });
    expect(note.text).toContain('### Next steps\n(Kabir Sethi) Send the studio the column list by Oct 12, 2026\n(Priya Rao) Book the courier for Friday');
    const steps = plainParse(nextStepsOf(note.text), '2026-10-08');
    expect(steps.map((x) => [x.owner, x.task, x.due])).toEqual([
      ['Kabir Sethi', 'Send the studio the column list', '2026-10-12'],
      ['Priya Rao', 'Book the courier for Friday', ''],
    ]);
    const drive = g.calls.find((c) => c.url.startsWith('https://www.googleapis.com/drive/v3/files/doc-notes-1/export'))!;
    expect(new URL(drive.url).searchParams.get('mimeType')).toBe('text/plain');
    expect(drive.auth).toBe(`Bearer ${ACCESS}`);
  });

  it('falls back to the transcript, with speaker names in place of participant ids', async () => {
    fakeGoogle({ routes: { ...transcriptRoutes, [`https://meet.googleapis.com/v2/${REC}/smartNotes`]: () => json({}), [`https://meet.googleapis.com/v2/${REC}`]: record, 'https://meet.googleapis.com/v2/spaces/sp-1': space } });
    const note = await readMeetMeeting(db, LEAD, 'rec-1');
    expect(note.kind).toBe('transcript');
    expect(note.text).toBe([
      'Kabir Sethi: Let us start with the sale. Kabir will send the column list.',
      'Priya Rao: I will book the courier.',
      'Someone: Thanks all.',
    ].join('\n'));
    expect(note.link).toBe('https://docs.google.com/document/d/doc-tr-1/edit');
  });

  it('uses the transcript too when the notes Doc cannot be opened', async () => {
    fakeGoogle({ routes: { ...transcriptRoutes, ...base, 'https://www.googleapis.com/drive/v3/files/doc-notes-1/export': () => json({ error: {} }, 403) } });
    expect((await readMeetMeeting(db, LEAD, 'rec-1')).kind).toBe('transcript');
  });

  it('says plainly when nobody turned on notes or a transcript', async () => {
    fakeGoogle({ routes: {
      [`https://meet.googleapis.com/v2/${REC}/smartNotes`]: () => json({}), [`https://meet.googleapis.com/v2/${REC}/transcripts?`]: () => json({}),
      [`https://meet.googleapis.com/v2/${REC}`]: record, 'https://meet.googleapis.com/v2/spaces/sp-1': space,
    } });
    await expect(readMeetMeeting(db, LEAD, 'rec-1')).rejects.toMatchObject({ status: 404, code: 'notes_unavailable', message: expect.stringMatching(/turned on/) });
  });

  it('asks the lead to connect again when Google no longer accepts the link', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ error: 'invalid_grant' }, 400)));
    await expect(listMeetMeetings(db, LEAD, { days: 14 })).rejects.toMatchObject({ code: 'meet_reauth' });
  });

  it('refuses without a link, and the message holds no token', async () => {
    await disconnectMeet(db, LEAD);
    vi.stubGlobal('fetch', vi.fn(async () => json({})));
    const err = await listMeetMeetings(db, LEAD, { days: 14 }).catch((e) => e);
    expect(err).toMatchObject({ code: 'not_connected' });
    expect(String(err.message)).not.toContain(REFRESH);
  });

  it('rejects an id that is not a conference record id', async () => {
    fakeGoogle();
    await expect(readMeetMeeting(db, LEAD, '../files')).rejects.toMatchObject({ status: 404 });
    await expect(readMeetMeeting(db, LEAD, 'a/b')).rejects.toMatchObject({ status: 404 });
  });

  it('reads through the routes for a lead, and refuses a member', async () => {
    fakeGoogle({ routes: { ...base, 'https://meet.googleapis.com/v2/conferenceRecords?': () => json({ conferenceRecords: [] }) } });
    signIn(LEAD);
    const one = await meetingGet(get('/api/v1/connections/google-meet/meetings/rec-1'), { params: Promise.resolve({ id: 'rec-1' }) });
    expect(one.status).toBe(200);
    expect((await one.json()).kind).toBe('notes');
    expect(await status(meetingsGet(get('/api/v1/connections/google-meet/meetings?days=14'), none))).toBe(200);
    const st = await (await meetGet(get('/api/v1/connections/google-meet'), none)).json();
    expect(st).toMatchObject({ enabled: true, connected: true, email: leadEmail.toLowerCase() });
    expect(JSON.stringify(st)).not.toContain('refresh');
    signIn((await member()).id);
    expect(await status(meetingsGet(get('/api/v1/connections/google-meet/meetings'), none))).toBe(403);
    expect(await status(meetingGet(get('/api/v1/connections/google-meet/meetings/rec-1'), { params: Promise.resolve({ id: 'rec-1' }) }))).toBe(403);
  });

  it('keeps a lead\'s meetings from an admin who views as that lead', async () => {
    const g = fakeGoogle({ routes: base });
    signIn(ADMIN, signView(ADMIN, LEAD));
    expect(await status(meetingGet(get('/api/v1/connections/google-meet/meetings/rec-1'), { params: Promise.resolve({ id: 'rec-1' }) }))).toBe(403);
    expect(g.fn).not.toHaveBeenCalled();
  });
});

// A Google Doc of minutes as the Docs API returns it: tabs, headings, bullets, person and date chips, and a table.
const DOC_ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789';
const run = (t: string) => ({ textRun: { content: t } });
const who = (name: string) => ({ person: { personProperties: { name, email: 'someone@example.test' } } });
const para = (els: unknown[], extra: Record<string, unknown> = {}) => ({ paragraph: { elements: els, ...extra } });
const head = (t: string, style = 'HEADING_2') => para([run(`${t}\n`)], { paragraphStyle: { namedStyleType: style } });
const item = (els: unknown[], level = 0) => para(els, { bullet: { listId: 'l1', nestingLevel: level } });
const cell = (els: unknown[]) => ({ content: [para(els)] });
const DOC = {
  title: 'Vendor sync 2026-10-08',
  tabs: [{
    tabProperties: { title: 'Week 41' },
    documentTab: { body: { content: [
      head('Vendor sync 2026-10-08', 'TITLE'),
      para([run('We met about the studio.\n')]),
      head('Action items'),
      item([run(' '), who('Kabir Sethi'), run(' send the margin sheet ('), { dateElement: { dateElementProperties: { displayText: 'Oct 12, 2026' } } }, run(')\n')]),
      item([run("pull last month's numbers\n")], 1),
      item([run('[Priya Rao] Book the courier\n')]),
      { table: { tableRows: [
        { tableCells: [cell([run('Owner\n')]), cell([run('Action item\n')]), cell([run('Due\n')])] },
        { tableCells: [cell([who('Ananya Rao'), run('\n')]), cell([run('Book the studio\n')]), cell([{ dateElement: { dateElementProperties: { timestamp: '2026-10-14T04:30:00Z' } } }])] },
      ] } },
    ] } },
    childTabs: [{ documentTab: { body: { content: [head('Notes'), para([run('From the second tab\n')])] } } }],
  }],
};
const postJson = (url: string, body: unknown) => new Request(`http://localhost${url}`, {
  method: 'POST', headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const readDoc = (link: string) => docPost(postJson('/api/v1/connections/google-meet/docs', { link }), none);
const docRoutes = { 'https://docs.googleapis.com/v1/documents/': () => json(DOC) };

describe('reading a Google Doc', () => {
  beforeEach(async () => { await saveLink(db, LEAD, { refreshToken: REFRESH, email: leadEmail, scopes: SCOPES }); });

  it('takes the id from a Doc link or a bare id, and nothing else', () => {
    expect(docIdOf(`https://docs.google.com/document/d/${DOC_ID}/edit?tab=t.0#heading=h.1`)).toBe(DOC_ID);
    expect(docIdOf(`https://docs.google.com/document/u/1/d/${DOC_ID}`)).toBe(DOC_ID);
    expect(docIdOf(` ${DOC_ID} `)).toBe(DOC_ID);
    expect(docIdOf(`https://docs.google.com/spreadsheets/d/${DOC_ID}/edit`)).toBeNull();
    expect(docIdOf(`https://evil.example/document/d/${DOC_ID}`)).toBeNull();
    expect(docIdOf('short-id')).toBeNull();
  });

  it('writes headings, bullets, chips, tables and every tab as lines the minutes reader knows', () => {
    expect(docToText(DOC)).toBe([
      '### Vendor sync 2026-10-08',
      'We met about the studio.',
      '### Next steps',
      '- (Kabir Sethi) send the margin sheet (Oct 12, 2026)',
      "  - pull last month's numbers",
      '- (Priya Rao) Book the courier',
      '- (Ananya Rao) Book the studio (Oct 14, 2026)',
      '### Notes',
      'From the second tab',
    ].join('\n'));
    expect(docToText({ body: { content: [para([run('Only a body\n')])] } })).toBe('Only a body'); // a Doc read without tabs
  });

  it('gives the steps with owners, dates and details through the existing reader', () => {
    const steps = plainParse(nextStepsOf(docToText(DOC)), '2026-10-08');
    expect(steps.map((x) => [x.owner, x.task, x.due])).toEqual([
      ['Kabir Sethi', "Send the margin sheet: pull last month's numbers", '2026-10-12'],
      ['Priya Rao', 'Book the courier', ''],
      ['Ananya Rao', 'Book the studio', '2026-10-14'],
    ]);
  });

  it('reads the Doc for a lead with the lead\'s own Google token', async () => {
    const g = fakeGoogle({ routes: docRoutes });
    signIn(LEAD);
    const res = await readDoc(`https://docs.google.com/document/d/${DOC_ID}/edit`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: DOC_ID, title: 'Vendor sync 2026-10-08', date: '2026-10-08', kind: 'notes', link: `https://docs.google.com/document/d/${DOC_ID}/edit` });
    const call = g.calls.find((c) => c.url.startsWith('https://docs.googleapis.com/'))!;
    expect(call.url).toBe(`https://docs.googleapis.com/v1/documents/${DOC_ID}?includeTabsContent=true`);
    expect(call.auth).toBe(`Bearer ${ACCESS}`);
  });

  it('refuses a member, a View as session and a link that is not a Doc, before Google is asked', async () => {
    const g = fakeGoogle({ routes: docRoutes });
    signIn((await member()).id);
    expect(await status(readDoc(DOC_ID))).toBe(403);
    signIn(ADMIN, signView(ADMIN, LEAD));
    expect(await status(readDoc(DOC_ID))).toBe(403);
    signIn(LEAD);
    expect(await code(readDoc('https://example.test/notes'))).toBe('bad_link');
    expect(g.fn).not.toHaveBeenCalled();
  });

  it('asks a lead linked before Docs could be read to connect again', async () => {
    await saveLink(db, LEAD, { refreshToken: REFRESH, email: leadEmail, scopes: SCOPES.slice(0, 2) });
    const g = fakeGoogle({ routes: docRoutes });
    signIn(LEAD);
    expect(await code(readDoc(DOC_ID))).toBe('docs_reauth');
    expect(g.fn).not.toHaveBeenCalled();
  });

  it('says so when Google refuses the Doc or the Doc is empty', async () => {
    signIn(LEAD);
    fakeGoogle({ routes: { 'https://docs.googleapis.com/v1/documents/': () => json({ error: { code: 403 } }, 403) } });
    expect(await code(readDoc(DOC_ID))).toBe('meet_forbidden');
    fakeGoogle({ routes: { 'https://docs.googleapis.com/v1/documents/': () => json({ title: 'Empty', body: { content: [] } }) } });
    expect(await code(readDoc(DOC_ID))).toBe('notes_unavailable');
  });

  it('is off with the switch', async () => {
    delete process.env.NICO_MEET;
    signIn(LEAD);
    expect(await status(readDoc(DOC_ID))).toBe(404);
  });
});

describe('the mappers', () => {
  it('turns Gemini next steps into the (Name) task shape and leaves a Doc without them whole', () => {
    expect(notesToMinutes('Summary\nWe met.\n\nNext steps\n- [A B] Do it\n• Rohan: Share the board\nPlain line\n')).toBe(
      'Summary\nWe met.\n\n### Next steps\n(A B) Do it\n(Rohan) Share the board\nPlain line');
    expect(notesToMinutes('Just a summary of the meeting.')).toBe('Just a summary of the meeting.');
  });

  it('cuts a very long transcript to what the import accepts', () => {
    const long = transcriptToText([{ speaker: 'A', text: 'word '.repeat(30_000) }]);
    expect(long.length).toBeLessThan(60_000);
    expect(long).toContain('Transcript cut here');
  });
});

describe('the upgrade', () => {
  it('adds the table to an older database with row level security on, and runs again safely', async () => {
    await db.exec(`DROP TABLE google_links;`);
    await upgrade(db);
    await upgrade(db);
    await saveLink(db, LEAD, { refreshToken: REFRESH, email: leadEmail, scopes: SCOPES });
    await saveLink(db, LEAD, { refreshToken: 'another-refresh-token', email: leadEmail, scopes: SCOPES }); // a second connect replaces the row
    expect((await db.query(`SELECT 1 FROM google_links`)).rows).toHaveLength(1);
    expect(openToken((await link()).refresh_enc, LEAD)).toBe('another-refresh-token');
    const { rows } = await db.query<{ relrowsecurity: boolean }>(`SELECT relrowsecurity FROM pg_class WHERE relname = 'google_links'`);
    expect(rows).toEqual([{ relrowsecurity: true }]);
  });

  it('is part of the base schema too', async () => {
    const { rows } = await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name = 'google_links' ORDER BY ordinal_position`);
    expect(rows.map((r) => r.column_name)).toEqual(['person_id', 'email', 'scopes', 'refresh_enc', 'created_at', 'last_used_at']);
  });
});

describe('the auth address', () => {
  it('is built only for this feature', () => {
    expect(meetAuthUrl('http://localhost/cb', 'st')).toContain('state=st');
  });
});
