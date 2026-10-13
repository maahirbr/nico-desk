import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { dataDir, type Db } from './db';
import { ApiError, bad, notFound } from './errors';
import { readIdToken } from './google';
import { istDate } from './time';
import type { MeetingNote, MeetingRow } from './connectors';

// Google Meet as a source of meeting minutes. A lead connects their own Google account once; the app then lists the
// meetings they attended and reads the Gemini notes (or the transcript) that Google already made. Nothing is recorded.
//
// Off unless GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and NICO_MEET=1 are set (and, on a hosted server, NICO_TOKEN_KEY).
//
// Scopes, asked only from the lead who connects, never at sign-in (incremental authorization):
//   meetings.space.readonly  (Sensitive) lists conference records, participants, transcripts, transcript entries and
//                            smart notes. https://developers.google.com/meet/api/guides/overview
//   drive.meet.readonly      (Restricted) lets the app export the notes or transcript Doc that Meet saved in Drive.
//                            https://developers.google.com/workspace/drive/api/guides/api-specific-auth
//   openid email             only to check that the Google account is the signed-in person's own.
// Endpoints (all read-only):
//   GET https://meet.googleapis.com/v2/conferenceRecords?filter=start_time>=...
//   GET https://meet.googleapis.com/v2/conferenceRecords/{id}  and  /v2/spaces/{id}
//   GET .../conferenceRecords/{id}/smartNotes | transcripts | participants, and .../transcripts/{t}/entries
//   GET https://www.googleapis.com/drive/v3/files/{docId}/export?mimeType=text/plain
//   POST https://oauth2.googleapis.com/token (code and refresh) and https://oauth2.googleapis.com/revoke
// Only the refresh token is kept, encrypted (AES-256-GCM) in google_links. Access tokens live in memory for one call.

export const MEET_SCOPES = [
  'https://www.googleapis.com/auth/meetings.space.readonly',
  'https://www.googleapis.com/auth/drive.meet.readonly',
] as const;

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke';
const MEET = 'https://meet.googleapis.com/v2';
const DRIVE = 'https://www.googleapis.com/drive/v3';
export const MEET_STATE_COOKIE = 'nd_meet_state';
export const MEET_CALLBACK_PATH = '/api/auth/google/meet/callback';
const STATE_TTL_MS = 10 * 60_000;
const MAX_TEXT = 58_000; // the import call accepts 60,000 characters

const clientId = () => (process.env.GOOGLE_CLIENT_ID ?? '').trim();
const clientSecret = () => (process.env.GOOGLE_CLIENT_SECRET ?? '').trim();
const hosted = () => !!process.env.VERCEL || !!process.env.DATABASE_URL;

// On a hosted server the encryption key must come from the environment. A key derived from the project id or the
// database address could be recomputed by anyone holding those, so it is never derived there.
export function meetEnabled(): boolean {
  if (process.env.NICO_MEET !== '1' || !clientId() || !clientSecret()) return false;
  if (hosted() && !(process.env.NICO_TOKEN_KEY ?? '').trim()) return false;
  return true;
}

export function requireMeet(): void {
  if (!meetEnabled()) throw notFound();
}

function tokenKeyMaterial(): string {
  const env = (process.env.NICO_TOKEN_KEY ?? '').trim();
  if (env) return env;
  if (hosted()) throw new Error('NICO_TOKEN_KEY must be set on a hosted server.');
  const file = path.join(dataDir(), 'token-key');
  fs.mkdirSync(dataDir(), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  return fs.readFileSync(file, 'utf8').trim();
}

// Two keys from one secret, each for one job, so a sealed token and a state value can never stand in for each other.
function subKey(label: string): Buffer {
  return Buffer.from(crypto.hkdfSync('sha256', tokenKeyMaterial(), 'nico-desk', `google-meet ${label}`, 32));
}

// aad ties the sealed value to one person, so a row copied to another person's id will not open.
export function sealToken(plain: string, personId: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', subKey('token'), iv);
  c.setAAD(Buffer.from(personId));
  const ct = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64url'), c.getAuthTag().toString('base64url'), ct.toString('base64url')].join('.');
}

export function openToken(sealed: string, personId: string): string {
  const [v, iv, tag, ct] = sealed.split('.');
  if (v !== 'v1' || !iv || !tag || !ct) throw new Error('Unreadable token.');
  const d = crypto.createDecipheriv('aes-256-gcm', subKey('token'), Buffer.from(iv, 'base64url'));
  d.setAAD(Buffer.from(personId));
  d.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(ct, 'base64url')), d.final()]).toString('utf8');
}

// ---- State: a signed, short-lived value bound to the signed-in person, and to the browser by a cookie nonce.

function stateMac(payload: string): string {
  return crypto.createHmac('sha256', subKey('state')).update(payload).digest('base64url');
}

export function newNonce(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export function signState(personId: string, nonce: string, now = Date.now()): string {
  const payload = Buffer.from(JSON.stringify({ p: personId, n: nonce, e: now + STATE_TTL_MS })).toString('base64url');
  return `${payload}.${stateMac(payload)}`;
}

export function checkState(state: string, personId: string, nonce: string, now = Date.now()): boolean {
  try {
    const i = state.lastIndexOf('.');
    if (i < 1) return false;
    const payload = state.slice(0, i);
    const got = Buffer.from(state.slice(i + 1));
    const want = Buffer.from(stateMac(payload));
    if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return false;
    const c = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { p?: unknown; n?: unknown; e?: unknown };
    if (typeof c.e !== 'number' || c.e <= now) return false;
    if (c.p !== personId || typeof c.n !== 'string' || !nonce) return false;
    const a = Buffer.from(c.n);
    const b = Buffer.from(nonce);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function meetAuthUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: ['openid', 'email', ...MEET_SCOPES].join(' '),
    state,
    access_type: 'offline', // a refresh token
    include_granted_scopes: 'true', // adds to what the person already allowed, if anything
    prompt: 'consent', // Google only returns a refresh token when it asks again
  });
  return `${AUTH_URL}?${q}`;
}

// ---- Google calls. Every one goes through fetch so tests can fake it. No token is ever logged or put in a message.

async function post(url: string, body: Record<string, string>): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError(502, 'source_unreachable', 'Google did not answer. Try again in a moment.');
  }
}

export type Granted = { refreshToken: string; email: string; scopes: string[] };

// Trades the code for tokens. Returns a reason code instead of throwing, because the caller turns it into a redirect.
export async function exchangeMeetCode(code: string, redirectUri: string): Promise<Granted | { error: 'google' | 'no_refresh' | 'scopes' | 'email' }> {
  const res = await post(TOKEN_URL, {
    code, client_id: clientId(), client_secret: clientSecret(), redirect_uri: redirectUri, grant_type: 'authorization_code',
  }).catch(() => null);
  if (!res || !res.ok) return { error: 'google' };
  const j = (await res.json().catch(() => null)) as { refresh_token?: unknown; id_token?: unknown; scope?: unknown } | null;
  if (!j || typeof j.id_token !== 'string') return { error: 'google' };
  const email = readIdToken(j.id_token, clientId());
  if (!email) return { error: 'email' };
  const scopes = typeof j.scope === 'string' ? j.scope.split(/\s+/).filter(Boolean) : [];
  // Google lets a person untick a permission on the consent screen. Without both, reading would half work.
  if (!MEET_SCOPES.every((s) => scopes.includes(s))) return { error: 'scopes' };
  if (typeof j.refresh_token !== 'string' || !j.refresh_token) return { error: 'no_refresh' };
  return { refreshToken: j.refresh_token, email, scopes };
}

// ---- google_links: one row per person.

type LinkRow = { person_id: string; email: string; scopes: string[]; refresh_enc: string; created_at: string; last_used_at: string | null };

export async function saveLink(db: Db, personId: string, g: Granted): Promise<void> {
  const sealed = sealToken(g.refreshToken, personId);
  await db.query(
    `INSERT INTO google_links (person_id, email, scopes, refresh_enc, created_at, last_used_at)
     VALUES ($1, $2, $3::text[], $4, now(), NULL)
     ON CONFLICT (person_id) DO UPDATE SET email = EXCLUDED.email, scopes = EXCLUDED.scopes, refresh_enc = EXCLUDED.refresh_enc, created_at = now(), last_used_at = NULL`,
    [personId, g.email, g.scopes, sealed],
  );
}

async function linkOf(db: Db, personId: string): Promise<LinkRow | null> {
  const { rows } = await db.query<LinkRow>(`SELECT * FROM google_links WHERE person_id = $1`, [personId]);
  return rows[0] ?? null;
}

export type MeetStatus = { enabled: true; connected: boolean; email: string | null; since: string | null };

export async function meetStatus(db: Db, personId: string): Promise<MeetStatus> {
  const l = await linkOf(db, personId);
  return { enabled: true, connected: !!l, email: l?.email ?? null, since: l?.created_at ?? null };
}

// Deletes the row first, then asks Google to revoke. If Google cannot be reached the link is still gone here.
export async function disconnectMeet(db: Db, personId: string): Promise<void> {
  const l = await linkOf(db, personId);
  if (!l) return;
  await db.query(`DELETE FROM google_links WHERE person_id = $1`, [personId]);
  try {
    const token = openToken(l.refresh_enc, personId);
    await post(REVOKE_URL, { token });
  } catch { /* the row is already gone; the person can also remove access in their Google account */ }
}

const needLink = () => bad('not_connected', 'Google Meet is not connected. Connect it from Connections.');
const reauth = () => new ApiError(400, 'meet_reauth', 'Google no longer accepts the saved link. Disconnect and connect Google Meet again.');

// A short-lived access token, fetched for one request and dropped after it.
async function accessToken(db: Db, personId: string): Promise<string> {
  const l = await linkOf(db, personId);
  if (!l) throw needLink();
  let refresh: string;
  try { refresh = openToken(l.refresh_enc, personId); } catch { throw reauth(); }
  const res = await post(TOKEN_URL, { client_id: clientId(), client_secret: clientSecret(), refresh_token: refresh, grant_type: 'refresh_token' });
  const j = (await res.json().catch(() => null)) as { access_token?: unknown; error?: unknown } | null;
  if (!res.ok || typeof j?.access_token !== 'string') {
    if (res.status === 400 || res.status === 401) throw reauth();
    throw new ApiError(502, 'source_error', `Google returned an error (${res.status}).`);
  }
  await db.query(`UPDATE google_links SET last_used_at = now() WHERE person_id = $1`, [personId]);
  return j.access_token;
}

async function call(url: string, token: string, text = false): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new ApiError(502, 'source_unreachable', 'Google did not answer. Try again in a moment.');
  }
  if (res.status === 401) throw reauth();
  if (res.status === 403) throw new ApiError(400, 'meet_forbidden', 'Google did not allow that. You can only read meetings you were part of. If this keeps happening, connect Google Meet again.');
  if (res.status === 404) throw new ApiError(404, 'not_found', 'Google has no such meeting or document.');
  if (res.status === 429) throw new ApiError(429, 'rate_limited', 'Google is busy. Wait a minute and try again.');
  if (!res.ok) throw new ApiError(502, 'source_error', `Google returned an error (${res.status}).`);
  return text ? res.text() : res.json().catch(() => null);
}

// A paged list, followed to the end but never past a cap.
async function all(url: string, token: string, key: string, pages = 20): Promise<any[]> {
  const out: any[] = [];
  let next = '';
  for (let i = 0; i < pages; i++) {
    const u = new URL(url);
    if (next) u.searchParams.set('pageToken', next);
    const data = await call(u.toString(), token);
    out.push(...((data?.[key] as any[]) ?? []));
    next = data?.nextPageToken ?? '';
    if (!next) break;
  }
  return out;
}

const ID = /^[A-Za-z0-9_-]{1,100}$/;
const idOf = (name: unknown) => (typeof name === 'string' ? name.replace(/^conferenceRecords\//, '') : '');

// ---- Listing: the last N days of conference records, titled by the meeting code of their space.

export async function listMeetMeetings(db: Db, personId: string, opts: { days: number; q?: string }): Promise<MeetingRow[]> {
  const token = await accessToken(db, personId);
  const since = new Date(Date.now() - Math.min(Math.max(opts.days, 1), 90) * 86400000).toISOString();
  const u = new URL(`${MEET}/conferenceRecords`);
  u.searchParams.set('filter', `start_time>="${since}"`);
  u.searchParams.set('pageSize', '25');
  const data = await call(u.toString(), token);
  const records: any[] = data?.conferenceRecords ?? [];
  const rows = await Promise.all(records.map(async (r): Promise<MeetingRow | null> => {
    const id = idOf(r.name);
    if (!ID.test(id)) return null;
    let title = 'Google Meet meeting';
    const space = typeof r.space === 'string' ? r.space : '';
    if (/^spaces\/[A-Za-z0-9_-]+$/.test(space)) {
      try {
        const s = await call(`${MEET}/${space}`, token);
        if (typeof s?.meetingCode === 'string' && s.meetingCode) title = `Meeting ${s.meetingCode}`;
      } catch { /* the title stays generic */ }
    }
    return { id, title, date: r.startTime ? istDate(r.startTime) : '', attendees: [] };
  }));
  const q = opts.q?.toLowerCase();
  return rows.filter((r): r is MeetingRow => !!r && (!q || r.title.toLowerCase().includes(q)));
}

// ---- Reading: the Gemini notes Doc if there is one, else the transcript.

const docUrl = (id: string) => `https://docs.google.com/document/d/${encodeURIComponent(id)}/edit`;

async function exportDoc(docId: string, token: string): Promise<string> {
  if (!ID.test(docId)) throw notFound();
  return String(await call(`${DRIVE}/files/${encodeURIComponent(docId)}/export?mimeType=${encodeURIComponent('text/plain')}`, token, true));
}

// Gemini writes its next steps as "[Name] task". The reader here expects "(Name) task" under a Next steps heading,
// the same shape the other connectors produce, so the same parser and model read all of them.
const STEPS_HEAD = /^(?:#+\s*)?(?:suggested\s+)?(?:next\s+steps|action\s+items)\s*:?$/i;
const OTHER_HEAD = /^(?:#+\s*)?(?:summary|details|more\s+details|transcript|attachments?|notes?)\s*:?$/i;

export function notesToMinutes(doc: string): string {
  const lines = doc.replace(/\r/g, '').split('\n').map((l) => l.trim());
  const at = lines.findIndex((l) => STEPS_HEAD.test(l));
  if (at < 0) return doc.trim().slice(0, MAX_TEXT);
  const steps: string[] = [];
  for (const raw of lines.slice(at + 1)) {
    if (!raw) continue;
    if (OTHER_HEAD.test(raw)) break;
    const l = raw.replace(/^[-*••●○■]+\s*/, '').replace(/\*\*/g, '').trim();
    const m = l.match(/^\[([^\]]+)\]\s*(.*)$/) ?? l.match(/^([A-Z][\p{L}'.-]+(?: [A-Z][\p{L}'.-]+)*):\s+(.*)$/u);
    steps.push(m ? `(${m[1].replace(/[()]/g, ' ').trim()}) ${m[2].trim()}` : l);
  }
  const body = steps.filter(Boolean).join('\n');
  const rest = lines.slice(0, at).join('\n').trim();
  return `${rest ? `${rest}\n\n` : ''}### Next steps\n${body}`.slice(0, MAX_TEXT);
}

export function transcriptToText(entries: { speaker: string; text: string }[]): string {
  const out: string[] = [];
  let last = '';
  for (const e of entries) {
    const text = e.text.replace(/\s+/g, ' ').trim();
    if (!text) continue;
    if (e.speaker === last && out.length) out[out.length - 1] += ` ${text}`;
    else out.push(`${e.speaker}: ${text}`);
    last = e.speaker;
  }
  const joined = out.join('\n');
  return joined.length > MAX_TEXT ? `${joined.slice(0, MAX_TEXT)}\n[Transcript cut here: it was longer than the app reads.]` : joined;
}

function speakerName(p: any): string {
  return String(p?.signedinUser?.displayName ?? p?.anonymousUser?.displayName ?? p?.phoneUser?.displayName ?? '').replace(/[()\n]/g, ' ').trim();
}

const ready = (x: any) => !!x?.docsDestination?.document && (x.state === undefined || x.state === 'FILE_GENERATED');

export type MeetNote = MeetingNote & { kind: 'notes' | 'transcript' };

export async function readMeetMeeting(db: Db, personId: string, id: string): Promise<MeetNote> {
  if (!ID.test(id)) throw notFound();
  const token = await accessToken(db, personId);
  const rec = await call(`${MEET}/conferenceRecords/${id}`, token);
  const date = rec?.startTime ? istDate(rec.startTime) : '';
  let title = 'Google Meet meeting';
  const space = typeof rec?.space === 'string' ? rec.space : '';
  if (/^spaces\/[A-Za-z0-9_-]+$/.test(space)) {
    try { const s = await call(`${MEET}/${space}`, token); if (s?.meetingCode) title = `Meeting ${s.meetingCode}`; } catch { /* generic title */ }
  }

  // 1. Gemini notes. If the Doc cannot be exported (it belongs to someone else, say), fall back to the transcript.
  try {
    const notes = (await all(`${MEET}/conferenceRecords/${id}/smartNotes?pageSize=10`, token, 'smartNotes', 2)).find(ready);
    if (notes) {
      const docId = String(notes.docsDestination.document);
      const text = notesToMinutes(await exportDoc(docId, token));
      if (text.trim()) return { id, title, date, text, link: docUrl(docId), kind: 'notes' };
    }
  } catch (e) {
    if (e instanceof ApiError && (e.code === 'rate_limited' || e.code === 'source_unreachable' || e.code === 'meet_reauth')) throw e;
  }

  // 2. The transcript, with participant names in place of resource names.
  const transcripts = await all(`${MEET}/conferenceRecords/${id}/transcripts?pageSize=10`, token, 'transcripts', 2);
  const t = transcripts.find((x) => typeof x?.name === 'string' && x.state !== 'STARTED');
  if (t && /^conferenceRecords\/[A-Za-z0-9_-]+\/transcripts\/[A-Za-z0-9_-]+$/.test(t.name)) {
    const people = new Map<string, string>();
    for (const p of await all(`${MEET}/conferenceRecords/${id}/participants?pageSize=100`, token, 'participants', 5)) {
      if (typeof p?.name === 'string') people.set(p.name, speakerName(p));
    }
    const entries = (await all(`${MEET}/${t.name}/entries?pageSize=100`, token, 'transcriptEntries', 30)).map((e) => ({
      speaker: people.get(String(e?.participant ?? '')) || 'Someone', text: String(e?.text ?? ''),
    }));
    const text = transcriptToText(entries);
    if (text.trim()) {
      const doc = t.docsDestination?.document;
      return { id, title, date, text, link: typeof doc === 'string' && ID.test(doc) ? docUrl(doc) : null, kind: 'transcript' };
    }
  }
  throw new ApiError(404, 'notes_unavailable',
    'Meet has no notes or transcript for this meeting. Note-taking or transcripts must be turned on during the meeting. They can take a few minutes to appear.');
}
