import crypto from 'node:crypto';
import { COOKIE, VIEW_COOKIE, checkSignIn, cookie, cookieOptions, isHttps, signSession } from '@/lib/auth';
import { exchangeCode, googleSignInEnabled } from '@/lib/google';
import { db } from '@/lib/db';
import { errorResponse, rateLimit } from '@/lib/http';

const STATE_COOKIE = 'nd_oauth_state';

function readCookie(req: Request, name: string): string {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Google sends the visitor back here. The email never goes into a URL: failures redirect with a short code only.
export async function GET(req: Request) {
  try {
    rateLimit(`google-cb:${req.headers.get('x-forwarded-for') ?? 'local'}`, 10);
    const url = new URL(req.url);
    const back = (error: string, secure = isHttps(req)) => {
      const res = new Response(null, { status: 302, headers: { Location: `${url.origin}/signin?error=${error}` } });
      res.headers.append('Set-Cookie', cookie('', 0, secure, STATE_COOKIE));
      return res;
    };
    if (!googleSignInEnabled()) return back('not_configured');
    if (url.searchParams.get('error')) return back('cancelled');
    const state = url.searchParams.get('state') ?? '';
    const code = url.searchParams.get('code') ?? '';
    const want = readCookie(req, STATE_COOKIE);
    if (!state || !want || !safeEqual(state, want) || !code) return back('state');
    const got = await exchangeCode(code, `${url.origin}/api/auth/google/callback`);
    if (!got) return back('google');
    const check = await checkSignIn(got.email);
    if (!check.ok) return back('not_allowed');
    // Keep Google's photo address fresh, only when the token carried one. Never blocks sign-in.
    if (got.picture) {
      try { await (await db()).query(`UPDATE people SET photo_url = $2 WHERE id = $1`, [check.personId, got.picture]); } catch { /* sign-in goes on */ }
    }
    const res = new Response(null, { status: 302, headers: { Location: `${url.origin}/` } });
    const secure = isHttps(req);
    res.headers.append('Set-Cookie', cookie(signSession(check.personId), cookieOptions.maxAge, secure, COOKIE));
    res.headers.append('Set-Cookie', cookie('', 0, secure, STATE_COOKIE));
    res.headers.append('Set-Cookie', cookie('', 0, secure, VIEW_COOKIE));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
