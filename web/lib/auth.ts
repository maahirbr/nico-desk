import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { dataDir, db } from './db';
import { derivedSecret } from './secret';
import { findPersonByEmail, getPerson, teamsOf, type Person } from './service';

// Sessions are a signed cookie naming a roster person. SPEC.md FR-54 asks for Google sign-in;
// until a Google client is issued, local runs use a roster picker, enabled only by NICO_DEV_SIGNIN=1.
// Either way the person must be on the roster, active, and on the allowed email domain.

export const COOKIE = 'nd_session';
const MAX_AGE_S = 60 * 60 * 12;

export type Me = { person: Person; team: { id: string; name: string; teamType: string } };

let cached: string | null = null;
function secret(): string {
  if (process.env.NICO_SESSION_SECRET) return process.env.NICO_SESSION_SECRET;
  if (process.env.VERCEL) return derivedSecret('session');
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

export const cookieOptions = { maxAge: MAX_AGE_S };

export function allowedDomain(): string {
  return (process.env.NICO_ALLOWED_DOMAIN || 'example.test').toLowerCase();
}

export function devSignInEnabled(): boolean {
  return process.env.NICO_DEV_SIGNIN === '1';
}

// Open demo (NICO_OPEN_DEMO=1): no sign-in. A visitor with no session is the team lead; the
// roster picker at /signin switches who they view as. Synthetic data only.
export const DEMO_PERSON = 'per_ada';
export function openDemo(): boolean {
  return process.env.NICO_OPEN_DEMO === '1';
}

// Returns the person id if they may sign in, else a reason.
export async function checkSignIn(email: string): Promise<{ ok: true; personId: string } | { ok: false; why: string }> {
  if (email.split('@')[1]?.toLowerCase() !== allowedDomain()) return { ok: false, why: 'That email is not on the company domain.' };
  const p = await findPersonByEmail(await db(), email);
  if (!p) return { ok: false, why: 'That email is not on the roster.' };
  if (!p.active) return { ok: false, why: 'That person is inactive.' };
  return { ok: true, personId: p.id };
}

export async function currentMe(): Promise<Me | null> {
  const id = verify((await cookies()).get(COOKIE)?.value) ?? (openDemo() ? DEMO_PERSON : null);
  if (!id) return null;
  const d = await db();
  const [team] = await teamsOf(d, id);
  if (!team) return null;
  const person = await getPerson(d, team.id, id);
  if (!person?.active || person.email.split('@')[1] !== allowedDomain()) return null;
  return { person, team };
}

export async function requireMe(): Promise<Me> {
  const me = await currentMe();
  if (!me) redirect('/signin');
  return me;
}
