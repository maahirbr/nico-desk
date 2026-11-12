import type { Db } from './db';
import { ApiError, notFound } from './errors';
import { readIdToken } from './google';
import { openToken, saveLink, type Granted } from './meet';

// Send a reminder from the lead's own Gmail (the PM's ask, 11 Nov). It reverses "the app never sends": the lead
// presses Send in the app, and the mail goes out from their own address, with their own Cc and Bcc.
//
// Off unless GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and NICO_GMAIL_SEND=1 are set (and, on a hosted server, NICO_TOKEN_KEY).
//
// Scope, asked only from the lead who connects, never at sign-in (incremental authorization):
//   gmail.send  (Sensitive) sends mail as the person. It cannot read, list or delete any mail.
//               https://developers.google.com/workspace/gmail/api/auth/scopes
// Endpoint: POST https://gmail.googleapis.com/gmail/v1/users/me/messages/send
// The link is the same google_links row Google Meet uses (one Google grant per person, so one refresh token).
// Disconnecting either one removes the row and asks Google to revoke the grant, so both stop.

export const GMAIL_SEND = 'https://www.googleapis.com/auth/gmail.send';
export const GMAIL_STATE_COOKIE = 'nd_gmail_state';
export const GMAIL_CALLBACK_PATH = '/api/auth/google/gmail/callback';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SEND_URL = 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send';
const clientId = () => (process.env.GOOGLE_CLIENT_ID ?? '').trim();
const clientSecret = () => (process.env.GOOGLE_CLIENT_SECRET ?? '').trim();
const hosted = () => !!process.env.VERCEL || !!process.env.DATABASE_URL;

export function gmailSendEnabled(): boolean {
  if (process.env.NICO_GMAIL_SEND !== '1' || !clientId() || !clientSecret()) return false;
  if (hosted() && !(process.env.NICO_TOKEN_KEY ?? '').trim()) return false;
  return true;
}

export function requireGmailSend(): void {
  if (!gmailSendEnabled()) throw notFound();
}

export function gmailAuthUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: clientId(), redirect_uri: redirectUri, response_type: 'code', state,
    scope: ['openid', 'email', GMAIL_SEND].join(' '),
    access_type: 'offline', include_granted_scopes: 'true', prompt: 'consent',
  });
  return `${AUTH_URL}?${q}`;
}

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

// Trades the code for tokens. Returns a reason code instead of throwing, because the caller turns it into a redirect.
export async function exchangeGmailCode(code: string, redirectUri: string): Promise<Granted | { error: 'google' | 'no_refresh' | 'scopes' | 'email' }> {
  const res = await post(TOKEN_URL, {
    code, client_id: clientId(), client_secret: clientSecret(), redirect_uri: redirectUri, grant_type: 'authorization_code',
  }).catch(() => null);
  if (!res || !res.ok) return { error: 'google' };
  const j = (await res.json().catch(() => null)) as { refresh_token?: unknown; id_token?: unknown; scope?: unknown } | null;
  if (!j || typeof j.id_token !== 'string') return { error: 'google' };
  const email = readIdToken(j.id_token, clientId());
  if (!email) return { error: 'email' };
  const scopes = typeof j.scope === 'string' ? j.scope.split(/\s+/).filter(Boolean) : [];
  if (!scopes.includes(GMAIL_SEND)) return { error: 'scopes' }; // the lead unticked it on Google's screen
  if (typeof j.refresh_token !== 'string' || !j.refresh_token) return { error: 'no_refresh' };
  return { refreshToken: j.refresh_token, email, scopes };
}

export { saveLink };

type Link = { email: string; scopes: string[]; refresh_enc: string };
async function linkOf(db: Db, personId: string): Promise<Link | null> {
  const { rows } = await db.query<Link>(`SELECT email, scopes, refresh_enc FROM google_links WHERE person_id = $1`, [personId]);
  return rows[0] ?? null;
}

export type GmailStatus = { connected: boolean; email: string | null };
export async function gmailStatus(db: Db, personId: string): Promise<GmailStatus> {
  const l = await linkOf(db, personId);
  return l && l.scopes.includes(GMAIL_SEND) ? { connected: true, email: l.email } : { connected: false, email: null };
}

const reauth = () => new ApiError(400, 'gmail_reauth', 'Google no longer accepts the saved link. Connect Gmail again.');

// ---- The message. Plain text and HTML in one multipart/alternative, every part base64, so no line can smuggle a header.

const KEEP = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'p', 'div', 'ul', 'ol', 'li', 'a']);

// The editor's HTML, cut down to the few tags its toolbar makes. Every attribute goes, except an http, https or mailto
// link on <a>. Script and style blocks go with their contents.
export function cleanHtml(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|head|title|iframe|object|embed|svg|math|template|textarea|select)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (_m, close: string, tag: string, attrs: string) => {
      const t = tag.toLowerCase();
      if (!KEEP.has(t)) return '';
      if (close) return `</${t}>`;
      if (t !== 'a') return `<${t}>`;
      const h = attrs.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
      const href = (h?.[1] ?? h?.[2] ?? '').trim();
      return /^(https?:|mailto:)/i.test(href.replace(/&amp;/g, '&')) ? `<a href="${href.replace(/"/g, '&quot;')}">` : '<a>';
    })
    .replace(/<(?![a-z/])/gi, '&lt;');
}

// RFC 2047: a header word outside plain ASCII goes as UTF-8 base64. Line breaks are dropped first, always.
const word = (s: string) => {
  const one = s.replace(/[\r\n]+/g, ' ').trim();
  return /^[\x20-\x7e]*$/.test(one) ? one : `=?UTF-8?B?${Buffer.from(one, 'utf8').toString('base64')}?=`;
};
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/.{76}/g, '$&\r\n');

export type Outgoing = { fromName: string; from: string; to: string[]; cc: string[]; bcc: string[]; subject: string; html: string; text: string };

export function buildMime(m: Outgoing, boundary = `nd-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`): string {
  const name = m.fromName.replace(/["\\\r\n]/g, '').trim();
  const head = [
    `From: ${name ? `${/^[\x20-\x7e]*$/.test(name) ? `"${name}"` : word(name)} ` : ''}<${m.from}>`,
    `To: ${m.to.join(', ')}`,
    ...(m.cc.length ? [`Cc: ${m.cc.join(', ')}`] : []),
    ...(m.bcc.length ? [`Bcc: ${m.bcc.join(', ')}`] : []),
    `Subject: ${word(m.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const part = (type: string, body: string) => [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`, 'Content-Transfer-Encoding: base64', '', b64(body)].join('\r\n');
  return [...head, '', part('text/plain', m.text), part('text/html', `<div>${cleanHtml(m.html)}</div>`), `--${boundary}--`, ''].join('\r\n');
}

// Sends one message as the person. The access token is fetched for this call and dropped after it.
export async function sendAsPerson(db: Db, personId: string, m: Omit<Outgoing, 'from'>): Promise<{ from: string }> {
  const l = await linkOf(db, personId);
  if (!l || !l.scopes.includes(GMAIL_SEND)) throw new ApiError(400, 'not_connected', 'Gmail is not connected. Connect it to send from here.');
  let refresh: string;
  try { refresh = openToken(l.refresh_enc, personId); } catch { throw reauth(); }
  const tok = await post(TOKEN_URL, { client_id: clientId(), client_secret: clientSecret(), refresh_token: refresh, grant_type: 'refresh_token' });
  const j = (await tok.json().catch(() => null)) as { access_token?: unknown } | null;
  if (!tok.ok || typeof j?.access_token !== 'string') {
    if (tok.status === 400 || tok.status === 401) throw reauth();
    throw new ApiError(502, 'source_error', `Google returned an error (${tok.status}).`);
  }
  await db.query(`UPDATE google_links SET last_used_at = now() WHERE person_id = $1`, [personId]);
  const raw = Buffer.from(buildMime({ ...m, from: l.email }), 'utf8').toString('base64url');
  let res: Response;
  try {
    res = await fetch(SEND_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${j.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw }), signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ApiError(502, 'source_unreachable', 'Google did not answer. The email may not have gone. Check your Gmail Sent folder before you try again.');
  }
  if (res.status === 401) throw reauth();
  if (res.status === 403) throw new ApiError(400, 'gmail_forbidden', 'Google did not allow sending from this account. Connect Gmail again.');
  if (res.status === 400) throw new ApiError(400, 'gmail_rejected', 'Gmail would not send this. Check the addresses.');
  if (res.status === 429) throw new ApiError(429, 'rate_limited', 'Gmail is busy. Wait a minute and try again.');
  if (!res.ok) throw new ApiError(502, 'source_error', `Google returned an error (${res.status}).`);
  return { from: l.email };
}
