import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Send a reminder through Resend when the lead has not connected Gmail (18 Nov). Resend and Google are never called:
// fetch is faked in every test, and every person, address and key here is made up.

const state = vi.hoisted(() => ({ jar: {} as Record<string, string>, testDb: null as unknown }));

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (n: string) => (n in state.jar ? { name: n, value: state.jar[n] } : undefined) }),
  headers: async () => new Headers(),
}));
vi.mock('../lib/db', async (orig) => ({ ...(await orig<typeof import('../lib/db')>()), db: async () => state.testDb }));

import { VIEW_COOKIE, COOKIE, signSession, signView } from '../lib/auth';
import { openDb, type Db } from '../lib/db';
import { saveLink } from '../lib/meet';
import { GMAIL_SEND } from '../lib/gmailSend';
import { resendFromLine, resendPayload, resendSendEnabled } from '../lib/resendSend';
import { TEAM_ID } from '../lib/seed';
import * as s from '../lib/service';
import { POST as sendPost } from '../app/api/v1/reminders/send/route';

const ADMIN = 'per_fay';
const LEAD = 'per_ada';
const KEY = 're_test_key_not_real_123456';
const FROM = 'reminders@example.org';
let db: Db;
let leadEmail: string;
let leadName: string;
let target: string;

const ENV = ['RESEND_API_KEY', 'NICO_RESEND_FROM', 'NICO_RESEND_SEND', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'NICO_GMAIL_SEND', 'NICO_TOKEN_KEY', 'VERCEL', 'DATABASE_URL'];
beforeAll(() => { process.env.NICO_SESSION_SECRET = 'resend-test-session-secret'; });
beforeEach(async () => {
  db = await openDb();
  state.testDb = db;
  state.jar = {};
  (globalThis as { __ndRate?: Map<string, unknown> }).__ndRate?.clear();
  process.env.RESEND_API_KEY = KEY;
  process.env.NICO_RESEND_FROM = FROM;
  process.env.NICO_RESEND_SEND = '1';
  const people = await s.listPeople(db, TEAM_ID);
  const lead = people.find((p) => p.id === LEAD)!;
  leadEmail = lead.email;
  leadName = lead.fullName ?? lead.displayName;
  // A member who owns or leads no project: since 27 Nov a project's owner or lead may send reminders for it.
  const { rows: heads } = await db.query<{ id: string }>(`SELECT owner_id AS id FROM projects UNION SELECT lead_id FROM projects WHERE lead_id IS NOT NULL`);
  const headIds = new Set(heads.map((h) => h.id));
  target = people.find((p) => p.active && p.id !== LEAD && p.appRoles.includes('member') && !p.appRoles.some((r) => ['lead', 'admin', 'leadership'].includes(r)) && !headIds.has(p.id))!.id;
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const k of ENV) delete process.env[k];
});

const signIn = (id: string, view?: string) => { state.jar = { [COOKIE]: signSession(id), ...(view ? { [VIEW_COOKIE]: view } : {}) }; };
const req = (body: unknown) => new Request('http://localhost/api/v1/reminders/send', {
  method: 'POST', headers: { origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json' }, body: JSON.stringify(body),
});
const none = { params: Promise.resolve({}) };
const json = (body: unknown, st = 200) => new Response(JSON.stringify(body), { status: st, headers: { 'content-type': 'application/json' } });

type Call = { url: string; auth: string; body: string };
function fake(resend: () => Response = () => json({ id: 'em_1' })) {
  const calls: Call[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ url, auth: headers.Authorization ?? '', body: init.body ? String(init.body) : '' });
    if (url === 'https://api.resend.com/emails') return resend();
    if (url === 'https://oauth2.googleapis.com/token') return json({ access_token: 'at-test' });
    if (url.startsWith('https://gmail.googleapis.com/')) return json({ id: 'm1' });
    return json({}, 404);
  }));
  return calls;
}
const toResend = (calls: Call[]) => calls.filter((c) => c.url === 'https://api.resend.com/emails');

const mail = (over: Record<string, unknown> = {}) => ({
  personId: target, to: ['owner@example.org'], cc: ['pm@example.org'], bcc: ['me-too@example.org'], subject: 'Two things are overdue',
  html: '<b>Hi</b><br><a href="https://x.test/me" onclick="x()">open</a><script>alert(1)</script>', text: 'Hi\nopen https://x.test/me', itemKeys: ['t1'], ...over,
});

describe('the switch', () => {
  it('is off unless the flag, the key and a plain sender address are all set', () => {
    expect(resendSendEnabled()).toBe(true);
    for (const [k, v] of [['NICO_RESEND_SEND', undefined], ['RESEND_API_KEY', ' '], ['NICO_RESEND_FROM', 'Nico <reminders@example.org>'], ['NICO_RESEND_FROM', 'not-an-address']] as const) {
      const was = process.env[k];
      if (v === undefined) delete process.env[k]; else process.env[k] = v;
      expect(resendSendEnabled()).toBe(false);
      process.env[k] = was;
    }
  });

  it('answers 404 with both Gmail send and Resend off', async () => {
    delete process.env.NICO_RESEND_SEND;
    const calls = fake();
    signIn(LEAD);
    expect((await sendPost(req(mail()), none)).status).toBe(404);
    expect(calls.length).toBe(0);
  });
});

describe('sending', () => {
  it('sends under the lead\'s name from the company sender, replies to the lead, keeps only safe HTML, and logs it as sent', async () => {
    const calls = fake();
    signIn(LEAD);
    const res = await sendPost(req(mail()), none);
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out).toEqual({ sent: true, from: FROM });
    expect(JSON.stringify(out)).not.toContain(KEY);
    const [call] = toResend(calls);
    expect(call.auth).toBe(`Bearer ${KEY}`);
    expect(JSON.parse(call.body)).toEqual({
      from: `${leadName} via nico-desk <${FROM}>`, reply_to: [leadEmail], to: ['owner@example.org'], cc: ['pm@example.org'], bcc: ['me-too@example.org'],
      subject: 'Two things are overdue', html: '<div><b>Hi</b><br><a href="https://x.test/me">open</a></div>', text: 'Hi\nopen https://x.test/me',
    });
    const { rows } = await db.query<{ channel: string; person_id: string }>(`SELECT channel, person_id FROM reminders WHERE sent_by = $1 ORDER BY at DESC LIMIT 1`, [LEAD]);
    expect(rows[0]).toEqual({ channel: 'sent', person_id: target });
  });

  it('uses the lead\'s own Gmail when it is connected', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.NICO_GMAIL_SEND = '1';
    process.env.NICO_TOKEN_KEY = 'resend-test-token-key';
    await saveLink(db, LEAD, { refreshToken: 'rt-test', email: leadEmail, scopes: ['openid', 'email', GMAIL_SEND] });
    const calls = fake();
    signIn(LEAD);
    expect(await (await sendPost(req(mail()), none)).json()).toEqual({ sent: true, from: leadEmail });
    expect(toResend(calls).length).toBe(0);
    expect(calls.some((c) => c.url.startsWith('https://gmail.googleapis.com/'))).toBe(true);
  });

  it('uses Resend when Gmail send is on but this lead has not connected it', async () => {
    process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
    process.env.NICO_GMAIL_SEND = '1';
    const calls = fake();
    signIn(LEAD);
    expect(await (await sendPost(req(mail()), none)).json()).toEqual({ sent: true, from: FROM });
    expect(toResend(calls).length).toBe(1);
  });

  it('sends nothing for a member, under View as, to someone off the team, or to a bad address', async () => {
    const calls = fake();
    signIn(target);
    expect((await sendPost(req(mail()), none)).status).toBe(403);
    signIn(ADMIN, signView(ADMIN, LEAD));
    expect((await (await sendPost(req(mail()), none)).json()).error.code).toBe('viewing_as');
    signIn(LEAD);
    expect((await sendPost(req(mail({ personId: 'per_nobody' })), none)).status).toBe(400);
    expect((await sendPost(req(mail({ cc: ['not an address\r\nBcc: x@y.z'] })), none)).status).toBe(400);
    expect(calls.length).toBe(0);
  });

  it('turns Resend refusals into plain messages and logs nothing', async () => {
    signIn(LEAD);
    const cases: [number, number, string][] = [[403, 502, 'resend_refused'], [401, 502, 'resend_refused'], [422, 400, 'resend_rejected'], [429, 429, 'rate_limited'], [500, 502, 'source_error']];
    for (const [given, status, code] of cases) {
      fake(() => json({ name: 'x', message: 'no' }, given));
      const res = await sendPost(req(mail()), none);
      expect(res.status).toBe(status);
      const body = await res.json();
      expect(body.error.code).toBe(code);
      expect(JSON.stringify(body)).not.toContain(KEY);
    }
    const { rows } = await db.query(`SELECT 1 FROM reminders WHERE sent_by = $1 AND channel = 'sent'`, [LEAD]);
    expect(rows.length).toBe(0);
  });
});

describe('the message', () => {
  it('cannot add an address or a line through the name or the subject', () => {
    expect(resendFromLine('Ada, <evil@x.test>;\r\nBcc: y')).toBe(`Ada evil x.test Bcc y via nico-desk <${FROM}>`);
    expect(resendFromLine("Zoë D'Souza-Rao")).toBe(`Zoë D'Souza-Rao via nico-desk <${FROM}>`);
    expect(resendFromLine('  ')).toBe(`nico-desk <${FROM}>`);
    const p = resendPayload({ fromName: 'Ada', replyTo: 'a@x.test', to: ['b@x.test'], cc: [], bcc: [], subject: 'Hi\r\nBcc: evil@x.test', html: '', text: 'x' });
    expect(p.subject).toBe('Hi Bcc: evil@x.test');
    expect('cc' in p || 'bcc' in p).toBe(false);
  });
});
