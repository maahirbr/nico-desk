import crypto from 'node:crypto';
import { cookie, isHttps } from '@/lib/auth';
import { authUrl, googleSignInEnabled } from '@/lib/google';
import { REQ_COOKIE } from '@/lib/mcpAuth';
import { errorResponse, rateLimit } from '@/lib/http';

const STATE_COOKIE = 'nd_oauth_state';

// Starts Google sign-in: remembers a random state in a short-lived cookie, then sends the visitor to Google.
export async function GET(req: Request) {
  try {
    rateLimit(`google:${req.headers.get('x-forwarded-for') ?? 'local'}`, 10);
    const origin = new URL(req.url).origin;
    if (!googleSignInEnabled()) return Response.redirect(`${origin}/signin?error=not_configured`, 302);
    const state = crypto.randomBytes(16).toString('base64url');
    const res = new Response(null, {
      status: 302,
      headers: { Location: authUrl(`${origin}/api/auth/google/callback`, state) },
    });
    res.headers.append('Set-Cookie', cookie(state, 600, isHttps(req), STATE_COOKIE));
    // A plain sign-in drops any half-finished Claude connection, so it cannot hijack this one.
    res.headers.append('Set-Cookie', cookie('', 0, isHttps(req), REQ_COOKIE));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
