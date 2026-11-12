import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Send a reminder from the lead's own Gmail (11 Nov). Google is never called: fetch is faked in every test, and every
// person, address and token here is made up.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { VIEW_COOKIE, COOKIE, signSession, signView } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { buildMime, cleanHtml, gmailSendEnabled, GMAIL_SEND } from '../lib/gmailSend';
import { meetStatus } from '../lib/meet';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { GET as callbackGet } from '../app/api/auth/google/gmail/callback/route';
import { DELETE as gmailDelete, GET as gmailGet, POST as gmailPost } from '../app/api/v1/connections/gmail/route';
import { POST as sendPost } from '../app/api/v1/reminders/send/route';

const ADMIN = 'per_fay';
const LEAD = 'per_ada';
const CLIENT = 'test-client.apps.googleusercontent.com';
const ACCESS = 'at-test-access-token-abcdef';
let db: Db;
let leadEmail: string;
let target: string;

const ENV = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NICO_GMAIL_SEND', 'NICO_TOKEN_KEY', 'VERCEL', 'DATABASE_URL'];
beforeAll(() => { process.env.NICO_SESSION_SECRET = 'gmail-test-session-secret'; });
beforeEach(async () => {
  db = await openDb();
  state.testDb = db;
  state.jar = {};
  (globalThis as { __ndRate?: Map<string, unknown> }).__ndRate?.clear();
  process.env.GOOGLE_CLIENT_ID = CLIENT;
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.NICO_GMAIL_SEND = '1';
  process.env.NICO_TOKEN_KEY = 'gmail-test-token-key';
  const people = await s.listPeople(db, TEAM_ID);
  leadEmail = people.find((p) => p.id === LEAD)!.email;
  target = people.find((p) => p.active && p.id !== LEAD && p.appRoles.includes('member'))!.id;
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV) delete process.env[k];
});

const signIn = (id: string, view?: string) => { state.jar = { [COOKIE]: signSession(id), ...(view ? { [VIEW_COOKIE]: view } : {}) }; };
const req = (url: string, method: string, body?: unknown) => new Request(`http://localhost${url}`, {
  method, headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
});
const none = { params: Promise.resolve({}) };
const json = (body: unknown, st = 200) => new Response(JSON.stringify(body), { status: st, headers: { 'content-type': 'application/json' } });
const idToken = (email: string) => {
  const part = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${part({ alg: 'none' })}.${part({ iss: 'https://accounts.google.com', aud: CLIENT, exp: Math.floor(Date.now() / 1000) + 600, email_verified: true, email })}.sig`;
};

type Call = { url: string; auth: string; body: string };
function fakeGoogle(opts: { email?: string; scope?: string; send?: () => Response } = {}) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ url, auth: headers.Authorization ?? '', body: init.body ? String(init.body) : '' });
    if (url === 'https://oauth2.googleapis.com/token') {
      if (new URLSearchParams(String(init.body)).get('grant_type') === 'refresh_token') return json({ access_token: ACCESS });
      return json({ refresh_token: 'rt-test', access_token: ACCESS, id_token: idToken(opts.email ?? leadEmail), scope: opts.scope ?? `openid email ${GMAIL_SEND}` });
    }
    if (url === 'https://oauth2.googleapis.com/revoke') return json({});
    if (url.startsWith('https://gmail.googleapis.com/')) return (opts.send ?? (() => json({ id: 'm1' })))();
    return json({}, 404);
  }));
  return calls;
}

async function connect(opts: { email?: string; scope?: string } = {}) {
  fakeGoogle(opts);
  signIn(LEAD);
  const res = await gmailPost(req('/api/v1/connections/gmail', 'POST'), none);
  const { url } = await res.json();
  const nonce = /nd_gmail_state=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')![1];
  const back = await callbackGet(new Request(`http://localhost/api/auth/google/gmail/callback?${new URLSearchParams({ code: 'c', state: new URL(url).searchParams.get('state')! })}`,
    { headers: { cookie: `nd_gmail_state=${nonce}` } }));
  return { url: new URL(url), where: new URL(back.headers.get('location')!).search };
}

const mail = (over: Record<string, unknown> = {}) => ({
  personId: target, to: ['owner@example.org'], cc: ['pm@example.org'], bcc: ['me-too@example.org'], subject: 'Two things are overdue',
  html: '<b>Hi</b><br><a href="https://x.test/me" onclick="x()">open</a><script>alert(1)</script>', text: 'Hi\nopen https://x.test/me', itemKeys: ['t1'], ...over,
});
const rawOf = (calls: Call[]) => Buffer.from(JSON.parse(calls.find((c) => c.url.startsWith('https://gmail'))!.body).raw, 'base64url').toString('utf8');

describe('the switch', () => {
  it('is off by default: every route answers 404', async () => {
    delete process.env.NICO_GMAIL_SEND;
    expect(gmailSendEnabled()).toBe(false);
    signIn(LEAD);
    expect((await gmailGet(req('/api/v1/connections/gmail', 'GET'), none)).status).toBe(404);
    expect((await gmailPost(req('/api/v1/connections/gmail', 'POST'), none)).status).toBe(404);
    expect((await sendPost(req('/api/v1/reminders/send', 'POST', mail()), none)).status).toBe(404);
    expect((await callbackGet(new Request('http://localhost/api/auth/google/gmail/callback?code=a&state=b'))).status).toBe(404);
  });

  it('stays off on a hosted server without its own token key', () => {
    process.env.VERCEL = '1';
    delete process.env.NICO_TOKEN_KEY;
    expect(gmailSendEnabled()).toBe(false);
  });
});

describe('connecting', () => {
  it('asks Google for gmail.send only, and saves a link that reads as Gmail, not as Meet', async () => {
    const { url, where } = await connect();
    expect(url.searchParams.get('scope')).toBe(`openid email ${GMAIL_SEND}`);
    expect(where).toBe('?gmail=connected');
    expect(await (await gmailGet(req('/api/v1/connections/gmail', 'GET'), none)).json()).toEqual({ connected: true, email: leadEmail });
    expect((await meetStatus(db, LEAD)).connected).toBe(false);
  });

  it('refuses another Google account, and an unticked send permission', async () => {
    expect((await connect({ email: 'someone-else@example.org' })).where).toBe('?gmail=mismatch');
    expect((await connect({ scope: 'openid email' })).where).toBe('?gmail=scopes');
    const { rows } = await db.query(`SELECT 1 FROM google_links WHERE person_id = $1`, [LEAD]);
    expect(rows.length).toBe(0);
  });

  it('disconnects', async () => {
    await connect();
    const res = await gmailDelete(req('/api/v1/connections/gmail', 'DELETE'), none);
    expect(await res.json()).toEqual({ connected: false, email: null });
  });
});

describe('sending', () => {
  it('sends from the lead\'s own address with Cc and Bcc, keeps only safe HTML, and logs it as sent', async () => {
    await connect();
    const calls = fakeGoogle();
    const res = await sendPost(req('/api/v1/reminders/send', 'POST', mail()), none);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: true, from: leadEmail });
    expect(calls.find((c) => c.url.startsWith('https://gmail'))!.auth).toBe(`Bearer ${ACCESS}`);
    const raw = rawOf(calls);
    expect(raw).toContain(`<${leadEmail}>`);
    expect(raw).toContain('To: owner@example.org');
    expect(raw).toContain('Cc: pm@example.org');
    expect(raw).toContain('Bcc: me-too@example.org');
    const html = Buffer.from(raw.split('Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n')[1].split('\r\n--')[0].replace(/\r\n/g, ''), 'base64').toString('utf8');
    expect(html).toBe('<div><b>Hi</b><br><a href="https://x.test/me">open</a></div>');
    const { rows } = await db.query<{ channel: string; person_id: string }>(`SELECT channel, person_id FROM reminders WHERE sent_by = $1 ORDER BY at DESC LIMIT 1`, [LEAD]);
    expect(rows[0]).toEqual({ channel: 'sent', person_id: target });
  });

  it('sends nothing for a member, under View as, to someone off the team, or before Gmail is connected', async () => {
    const calls = fakeGoogle();
    signIn(LEAD);
    expect((await (await sendPost(req('/api/v1/reminders/send', 'POST', mail()), none)).json()).error.code).toBe('not_connected');
    await connect();
    const after = fakeGoogle();
    expect((await sendPost(req('/api/v1/reminders/send', 'POST', mail({ personId: 'per_nobody' })), none)).status).toBe(400);
    signIn(target);
    expect((await sendPost(req('/api/v1/reminders/send', 'POST', mail()), none)).status).toBe(403);
    signIn(ADMIN, signView(ADMIN, LEAD));
    expect((await (await sendPost(req('/api/v1/reminders/send', 'POST', mail()), none)).json()).error.code).toBe('viewing_as');
    expect([...calls, ...after].some((c) => c.url.startsWith('https://gmail'))).toBe(false);
  });

  it('refuses a bad address before calling Google', async () => {
    await connect();
    const calls = fakeGoogle();
    expect((await sendPost(req('/api/v1/reminders/send', 'POST', mail({ cc: ['not an address\r\nBcc: x@y.z'] })), none)).status).toBe(400);
    expect(calls.length).toBe(0);
  });
});

describe('the message', () => {
  it('cannot be given an extra header through the subject or the name', () => {
    const raw = buildMime({ fromName: 'Ada\r\nBcc: evil@x.test', from: 'a@x.test', to: ['b@x.test'], cc: [], bcc: [], subject: 'Hi\r\nBcc: evil@x.test', html: '', text: 'x' }, 'B');
    const head = raw.split('\r\n\r\n')[0];
    expect(head.split('\r\n').filter((l) => l.startsWith('Bcc:'))).toEqual([]);
    expect(head).toContain('Subject: Hi Bcc: evil@x.test');
  });

  it('encodes a subject outside plain ASCII', () => {
    const raw = buildMime({ fromName: 'Ada', from: 'a@x.test', to: ['b@x.test'], cc: [], bcc: [], subject: 'Due — today', html: '', text: 'x' }, 'B');
    expect(raw).toContain(`Subject: =?UTF-8?B?${Buffer.from('Due — today').toString('base64')}?=`);
  });

  it('keeps only the toolbar\'s tags and safe links', () => {
    expect(cleanHtml('<p style="x"><i>a</i><u>b</u><img src=x onerror=alert(1)><a href="javascript:alert(1)">c</a></p><style>p{}</style>'))
      .toBe('<p><i>a</i><u>b</u><a>c</a></p>');
    expect(cleanHtml('<ul><li>one</li></ul><a href=\'mailto:a@x.test\'>m</a>')).toBe('<ul><li>one</li></ul><a href="mailto:a@x.test">m</a>');
  });
});
