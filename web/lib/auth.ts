import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dataDir, db } from './db';
import { derivedSecret } from './secret';
import { findPersonByEmail, getPerson, teamsOf, type Person } from './service';

// Sessions are a signed cookie naming a roster person. SPEC.md FR-54 asks for Google sign-in
// (lib/google.ts, app/api/auth/google/). Local runs can also use a roster picker, enabled only by
// NICO_DEV_SIGNIN=1. Either way the person must be on the roster, active, and on the allowed email domain.

export const COOKIE = 'nd_session';
const MAX_AGE_S = 60 * 60 * 12;

// person is who the pages and rules treat as the signed-in user. When an admin is "viewing as" someone,
// person is that someone and viewingAs is true; realPerson is always the signed-in session person. Audit and
// the read-only guard (lib/http.ts) use realPerson. Nothing is written while viewingAs.
export type Me = { person: Person; realPerson: Person; viewingAs: boolean; team: { id: string; name: string; teamType: string } };

let cached: string | null = null;
function secret(): string {
  if (process.env.NICO_SESSION_SECRET) return process.env.NICO_SESSION_SECRET;
  if (process.env.VERCEL) return derivedSecret('session', 'NICO_SESSION_SECRET');
  if (cached) return cached;
  const file = path.join(dataDir(), 'session-secret');
  fs.mkdirSync(dataDir(), { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  cached = fs.readFileSync(file, 'utf8').trim();
  return cached;
}

function mac(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function signSession(personId: string): string {
  const payload = `${personId}.${Math.floor(Date.now() / 1000) + MAX_AGE_S}`;
  return `${payload}.${mac(payload)}`;
}

function verify(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(mac(payload));
  if (sig.length !== want.length || !crypto.timingSafeEqual(sig, want)) return null;
  const [personId, exp] = payload.split('.');
  return Number(exp) > Date.now() / 1000 ? personId : null;
}

// "View as": an admin reviews the site as another person. The cookie names the real session person, the
// person viewed and an expiry, and is signed with its own label so a session token cannot stand in for it.
// It counts only while the session person is an admin (resolveMe); anyone else's copy is ignored.
export const VIEW_COOKIE = 'nd_view';

export function signView(realId: string, targetId: string): string {
  const payload = `${realId}.${targetId}.${Math.floor(Date.now() / 1000) + MAX_AGE_S}`;
  return `${payload}.${mac(`view:${payload}`)}`;
}

// The viewed person's id, or null when the token is missing, forged, expired or issued to another session person.
export function verifyView(token: string | undefined, realId: string): string | null {
  if (!token) return null;
  const i = token.lastIndexOf('.');
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const sig = Buffer.from(token.slice(i + 1));
  const want = Buffer.from(mac(`view:${payload}`));
  if (sig.length !== want.length || !crypto.timingSafeEqual(sig, want)) return null;
  const [real, target, exp] = payload.split('.');
  return real === realId && target && Number(exp) > Date.now() / 1000 ? target : null;
}

export const cookieOptions = { maxAge: MAX_AGE_S };

// Secure whenever the request came over HTTPS, so plain http://localhost still works.
export function isHttps(req: Request): boolean {
  return new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

export function cookie(value: string, maxAge: number, secure: boolean, name = COOKIE): string {
  return [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`, ...(secure ? ['Secure'] : [])].join('; ');
}

export function allowedDomain(): string {
  return (process.env.NICO_ALLOWED_DOMAIN || 'example.test').toLowerCase();
}

// The company domain, plus single addresses let in from outside it (NICO_ALLOWED_EMAILS, comma-separated, env only
// so no address sits in the repo). Each one must still be an active person on the roster.
export function emailAllowed(email: string): boolean {
  const e = email.trim().toLowerCase();
  if (e.split('@')[1] === allowedDomain()) return true;
  return (process.env.NICO_ALLOWED_EMAILS ?? '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean).includes(e);
}

// A hosted database holds the real pilot, so the roster picker and the open demo stay off there even if
// their flag is set by mistake. NICO_ALLOW_DEMO_IN_HOSTED=1 is the deliberate override. A Vercel production
// deploy is locked as well, with no override, so a missing DATABASE_URL cannot open it (security review 26 Oct).
// Vercel previews run the open demo on fixtures, so they stay unlocked.
const hostedLock = () => process.env.VERCEL_ENV === 'production'
  || (!!process.env.DATABASE_URL && process.env.NICO_ALLOW_DEMO_IN_HOSTED !== '1');

export function devSignInEnabled(): boolean {
  return process.env.NICO_DEV_SIGNIN === '1' && !hostedLock();
}

// Open demo (NICO_OPEN_DEMO=1): no sign-in. A visitor with no session is the team lead (DEMO_PERSON
// on the fixtures, else the first lead); the roster picker at /signin switches who they view as.
export const DEMO_PERSON = 'per_ada';
export function openDemo(): boolean {
  return process.env.NICO_OPEN_DEMO === '1' && !hostedLock();
}

// Returns the person id if they may sign in, else a reason.
export async function checkSignIn(email: string): Promise<{ ok: true; personId: string } | { ok: false; why: string }> {
  if (!emailAllowed(email)) return { ok: false, why: 'That email is not on the company domain.' };
  const p = await findPersonByEmail(await db(), email);
  if (!p) return { ok: false, why: 'That email is not on the roster.' };
  if (!p.active) return { ok: false, why: 'That person is inactive.' };
  return { ok: true, personId: p.id };
}

type Database = Awaited<ReturnType<typeof db>>;

// The signed-in person, plus the person being viewed when an admin has chosen "View as" (viewToken).
// The pure core of currentMe, so tests can call it without request cookies.
export async function resolveMe(d: Database, sessionId: string | null, viewToken?: string): Promise<Me | null> {
  if (!sessionId) return null;
  const [team] = await teamsOf(d, sessionId);
  if (!team) return null;
  const ok = (p: Person | null): p is Person => !!p?.active && emailAllowed(p.email);
  const real = await getPerson(d, team.id, sessionId);
  if (!ok(real)) return null;
  if (real.appRoles.includes('admin')) {
    const target = verifyView(viewToken, real.id);
    if (target && target !== real.id) {
      const viewed = await getPerson(d, team.id, target);
      if (ok(viewed)) return { person: viewed, realPerson: real, viewingAs: true, team };
    }
  }
  return { person: real, realPerson: real, viewingAs: false, team };
}

export async function currentMe(): Promise<Me | null> {
  // Cookies first: at build time this ends the prerender before the database opens. Nine build workers that each
  // open the same PGlite folder made the build fail now and then (Aborted() on /status, /week, /_not-found).
  const jar = await cookies();
  const d = await db();
  const id = verify(jar.get(COOKIE)?.value) ?? (openDemo() ? await demoPerson(d) : null);
  return resolveMe(d, id, jar.get(VIEW_COOKIE)?.value);
}

// The signed-in person with any "View as" ignored. Only the View as endpoint itself uses this.
export async function currentRealMe(): Promise<Me | null> {
  const d = await db();
  const id = verify((await cookies()).get(COOKIE)?.value) ?? (openDemo() ? await demoPerson(d) : null);
  return resolveMe(d, id);
}

async function demoPerson(d: Awaited<ReturnType<typeof db>>): Promise<string | null> {
  const { rows } = await d.query<{ id: string }>(
    `SELECT person_id AS id FROM team_members WHERE app_role = 'lead' ORDER BY person_id = $1 DESC, person_id LIMIT 1`, [DEMO_PERSON]);
  return rows[0]?.id ?? null;
}

export async function requireMe(): Promise<Me> {
  const me = await currentMe();
  if (!me) redirect('/signin');
  return me;
}
