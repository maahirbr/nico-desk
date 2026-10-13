import { cookie, currentMe, isHttps } from '@/lib/auth';
import { db } from '@/lib/db';
import { errorResponse, rateLimit } from '@/lib/http';
import { checkState, exchangeMeetCode, MEET_CALLBACK_PATH, MEET_STATE_COOKIE, meetEnabled, saveLink } from '@/lib/meet';
import { isLeadOrAdmin } from '@/lib/roles';

function readCookie(req: Request, name: string): string {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

// Google sends the lead back here after the Meet permission screen. This is outside route(), so it does its own checks:
// the flag, the session, View as, the lead role, the signed state, and that the Google account is the lead's own.
// Failures redirect with a short code. No address, token or code ever goes into a URL.
export async function GET(req: Request) {
  try {
    rateLimit(`meet-cb:${req.headers.get('x-forwarded-for') ?? 'local'}`, 10);
    if (!meetEnabled()) return new Response(null, { status: 404 });
    const url = new URL(req.url);
    const secure = isHttps(req);
    const back = (code: string) => {
      const res = new Response(null, { status: 302, headers: { Location: `${url.origin}/connections?meet=${code}` } });
      res.headers.append('Set-Cookie', cookie('', 0, secure, MEET_STATE_COOKIE));
      return res;
    };
    const me = await currentMe();
    if (!me) return new Response(null, { status: 302, headers: { Location: `${url.origin}/signin` } });
    if (me.viewingAs) return back('viewing_as'); // View as is read-only: nothing is saved
    if (!isLeadOrAdmin(me.person.appRoles)) return back('not_allowed');
    if (url.searchParams.get('error')) return back('cancelled');
    const state = url.searchParams.get('state') ?? '';
    const code = url.searchParams.get('code') ?? '';
    if (!code || !checkState(state, me.realPerson.id, readCookie(req, MEET_STATE_COOKIE))) return back('state');
    const got = await exchangeMeetCode(code, `${url.origin}${MEET_CALLBACK_PATH}`);
    if ('error' in got) return back(got.error);
    // The account Google signed in must be this person's own address, or the link would read someone else's meetings.
    const d = await db();
    const { rows } = await d.query(
      `SELECT 1 FROM people WHERE id = $1 AND (lower(email) = $2 OR $2 IN (SELECT lower(a) FROM unnest(alt_emails) AS a))`,
      [me.realPerson.id, got.email],
    );
    if (!rows.length) return back('mismatch');
    await saveLink(d, me.realPerson.id, got);
    return back('connected');
  } catch (e) {
    return errorResponse(e);
  }
}
