import { z } from 'zod';
import { COOKIE, checkSignIn, cookieOptions, devSignInEnabled, signSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { ApiError } from '@/lib/errors';
import { errorResponse, rateLimit, readBody, sameOrigin } from '@/lib/http';

// Local sign-in by roster pick (NICO_DEV_SIGNIN=1). Google sign-in replaces this when a client is issued.
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    rateLimit(`signin:${req.headers.get('x-forwarded-for') ?? 'local'}`, 10);
    if (!devSignInEnabled()) throw new ApiError(501, 'not_configured', 'Google sign-in is not configured yet.');
    const { personId } = await readBody(req, z.object({ personId: z.string() }).strict());
    const { rows } = await (await db()).query<{ email: string }>(`SELECT email FROM people WHERE id = $1`, [personId]);
    if (!rows[0]) throw new ApiError(403, 'not_allowed', 'That person is not on the roster.');
    const check = await checkSignIn(rows[0].email);
    if (!check.ok) throw new ApiError(403, 'not_allowed', check.why);
    const res = Response.json({ ok: true });
    res.headers.append('Set-Cookie', cookie(signSession(check.personId), cookieOptions.maxAge, isHttps(req)));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const res = new Response(null, { status: 204 });
    res.headers.append('Set-Cookie', cookie('', 0, isHttps(req)));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

// Secure whenever the request came over HTTPS, so plain http://localhost still works.
function isHttps(req: Request): boolean {
  return new URL(req.url).protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
}

function cookie(value: string, maxAge: number, secure: boolean): string {
  return [`${COOKIE}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`, ...(secure ? ['Secure'] : [])].join('; ');
}
