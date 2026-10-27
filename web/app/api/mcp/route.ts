import { resolveMe } from '@/lib/auth';
import { db, scoped } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { rateLimit } from '@/lib/http';
import { handle } from '@/lib/mcp';
import { challengeHeader, readAccess } from '@/lib/mcpAuth';

export const dynamic = 'force-dynamic';

// The MCP endpoint Claude talks to (lib/mcp.ts has the protocol and the tools). Each POST carries a bearer token
// from the OAuth flow in lib/mcpAuth.ts; the person it names is checked as active and allowed on every call, the
// same check a session cookie gets, and every query runs fenced to their team.

// A browser page may only call this from the app itself, Claude, or a local tool (MCP transport rules on Origin).
function originAllowed(req: Request, self: string): boolean {
  const o = req.headers.get('origin');
  if (!o || o === self) return true;
  try {
    const u = new URL(o);
    if (u.protocol === 'https:') return u.hostname === 'claude.ai' || u.hostname === 'claude.com';
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]');
  } catch {
    return false;
  }
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  body === null ? new Response(null, { status, headers }) : Response.json(body, { status, headers });

export async function POST(req: Request) {
  const origin = new URL(req.url).origin;
  if (!originAllowed(req, origin)) return json(403, { error: 'origin_not_allowed' });
  const unauthorized = () => json(401, { error: 'invalid_token' }, { 'WWW-Authenticate': challengeHeader(origin) });
  const access = readAccess(req.headers.get('authorization'), origin);
  if (!access) return unauthorized();
  try {
    rateLimit(`mcp:${access.personId}`, 120);
    const d = await db();
    const me = await resolveMe(d, access.personId);
    if (!me) return unauthorized();
    let msg: unknown;
    try { msg = await req.json(); } catch { return json(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error.' } }); }
    const out = await handle(msg, req.headers.get('mcp-protocol-version'), async () => ({ db: scoped(d, me.team.id), me, origin }));
    return json(out.status, out.body);
  } catch (e) {
    if (e instanceof ApiError && e.status === 429) return json(429, { error: 'rate_limited' }, { 'Retry-After': '60' });
    console.error('[mcp] request failed', e instanceof Error ? e.message.slice(0, 200) : 'unknown');
    return json(500, { jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Internal error.' } });
  }
}

// No server-to-client stream and no sessions: every exchange is one POST.
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
export const DELETE = GET;
