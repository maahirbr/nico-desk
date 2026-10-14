import { z } from 'zod';
import { currentMe, type Me } from './auth';
import { db, type Db } from './db';
import { ApiError, forbidden } from './errors';

// One wrapper for every /api/v1 route: session, same-origin check on writes, rate limits,
// Zod-checked bodies and the SPEC.md 4.1 error shape.

type Window = { start: number; n: number };
const g = globalThis as unknown as { __ndRate?: Map<string, Window> };
const buckets = (g.__ndRate ??= new Map());

export function rateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  const w = buckets.get(key);
  if (!w || now - w.start >= windowMs) {
    buckets.set(key, { start: now, n: 1 });
    return;
  }
  if (++w.n > limit) throw new ApiError(429, 'rate_limited', 'Too many requests. Wait a minute and try again.');
}

export function sameOrigin(req: Request): void {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) throw new ApiError(403, 'not_allowed', 'Cross-site request refused.');
}

export function errorResponse(e: unknown): Response {
  if (e instanceof ApiError) {
    return Response.json({ error: { code: e.code, message: e.message, ...(e.field ? { field: e.field } : {}) } }, { status: e.status });
  }
  if (e instanceof z.ZodError) {
    const issue = e.issues[0];
    return Response.json(
      { error: { code: 'invalid_body', message: issue?.message ?? 'Invalid body.', ...(issue?.path.length ? { field: issue.path.join('.') } : {}) } },
      { status: 400 },
    );
  }
  console.error('[api] unhandled', e instanceof Error ? e.message.slice(0, 200) : 'unknown');
  return Response.json({ error: { code: 'server_error', message: 'Something went wrong.' } }, { status: 500 });
}

export async function readBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, 'invalid_body', 'The body must be JSON.');
  }
  return schema.parse(raw);
}

type Args<P> = { req: Request; params: P; me: Me; db: Db };

export function route<P = Record<string, never>>(fn: (a: Args<P>) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const me = await currentMe();
      if (!me) throw new ApiError(401, 'not_signed_in', 'Sign in first.');
      if (req.method !== 'GET') {
        sameOrigin(req);
        rateLimit(`w:${me.person.id}`, 60);
      }
      const out = await fn({ req, params: await ctx.params, me, db: await db() });
      if (out instanceof Response) return out;
      return Response.json(out ?? null);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function sameTeam(me: Me, teamId: string): void {
  if (me.team.id !== teamId) throw forbidden('You are not on that team.');
}

// Shared body pieces
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
export const zVersion = z.number().int().positive();
