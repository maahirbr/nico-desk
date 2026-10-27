import crypto from 'node:crypto';
import { cookie, currentRealMe, isHttps } from '@/lib/auth';
import { authUrl, googleSignInEnabled } from '@/lib/google';
import { errorResponse, rateLimit, sameOrigin } from '@/lib/http';
import { issueCode, readRequest, REQ_COOKIE, sealRequest, withParams } from '@/lib/mcpAuth';

const STATE_COOKIE = 'nd_oauth_state';

// The /connect page posts here when the person says yes (or no). Signed in already: the code goes straight back
// to Claude. Not signed in: Google first, carrying the request in a short cookie that the Google callback reads.
// No app session is made on the way; connecting Claude does not sign anyone in to the app.
export async function POST(req: Request) {
  try {
    sameOrigin(req);
    rateLimit(`mcp-auth:${req.headers.get('x-forwarded-for') ?? 'local'}`, 20);
    const origin = new URL(req.url).origin;
    const form = await req.formData();
    const r = readRequest(String(form.get('req') ?? ''));
    if (!r) return new Response('This request has expired. Start again from Claude.', { status: 400 });
    const go = (to: string) => new Response(null, { status: 303, headers: { Location: to } });
    if (form.get('deny')) return go(withParams(r.redirectUri, { error: 'access_denied', state: r.state, iss: origin }));
    const me = await currentRealMe();
    if (me) return go(issueCode(r, me.realPerson.id, origin));
    if (!googleSignInEnabled()) return new Response('Sign-in is not set up.', { status: 400 });
    const state = crypto.randomBytes(16).toString('base64url');
    const res = go(authUrl(`${origin}/api/auth/google/callback`, state));
    res.headers.append('Set-Cookie', cookie(state, 600, isHttps(req), STATE_COOKIE));
    res.headers.append('Set-Cookie', cookie(sealRequest(r), 600, isHttps(req), REQ_COOKIE));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
