import { cookie, currentMe, isHttps } from '@/lib/auth';
import { db, scoped } from '@/lib/db';
import { errorResponse, rateLimit } from '@/lib/http';
import { exchangeGmailCode, GMAIL_CALLBACK_PATH, GMAIL_STATE_COOKIE, gmailSendEnabled, saveLink } from '@/lib/gmailSend';
import { checkState } from '@/lib/meet';
import { isLeadOrAdmin } from '@/lib/roles';

function readCookie(req: Request, name: string): string {
  for (const part of (req.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

// Google sends the lead back here after the Gmail permission screen. The same checks as the Meet callback: the flag,
// the session, View as, the lead role, the signed state, and that the Google account is the lead's own.
// Failures redirect to Reminders with a short code. No address, token or code ever goes into a URL.
export async function GET(req: Request) {
  try {
    rateLimit(`gmail-cb:${req.headers.get('x-forwarded-for') ?? 'local'}`, 10);
    if (!gmailSendEnabled()) return new Response(null, { status: 404 });
    const url = new URL(req.url);
    const back = (code: string) => {
      const res = new Response(null, { status: 302, headers: { Location: `${url.origin}/reminders?gmail=${code}` } });
      res.headers.append('Set-Cookie', cookie('', 0, isHttps(req), GMAIL_STATE_COOKIE));
      return res;
    };
    const me = await currentMe();
    if (!me) return new Response(null, { status: 302, headers: { Location: `${url.origin}/signin` } });
    if (me.viewingAs) return back('viewing_as');
    if (!isLeadOrAdmin(me.person.appRoles)) return back('not_allowed');
    if (url.searchParams.get('error')) return back('cancelled');
    const state = url.searchParams.get('state') ?? '';
    const code = url.searchParams.get('code') ?? '';
    if (!code || !checkState(state, me.realPerson.id, readCookie(req, GMAIL_STATE_COOKIE))) return back('state');
    const got = await exchangeGmailCode(code, `${url.origin}${GMAIL_CALLBACK_PATH}`);
    if ('error' in got) return back(got.error);
    // The Google account must be this person's own address, or mail would go out from someone else's.
    const d = scoped(await db(), me.team.id);
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
