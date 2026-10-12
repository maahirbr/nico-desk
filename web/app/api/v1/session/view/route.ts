import { z } from 'zod';
import { VIEW_COOKIE, cookie, cookieOptions, currentRealMe, isHttps, signView } from '@/lib/auth';
import { db } from '@/lib/db';
import { ApiError, forbidden } from '@/lib/errors';
import { errorResponse, rateLimit, readBody, sameOrigin } from '@/lib/http';
import { getPerson } from '@/lib/service';

// "View as" (admins only). POST picks a roster person to see the site as, DELETE goes back to the admin's own
// view. Both read the real session person, never the viewed one, so a view cannot be used to pick another view.
async function realAdmin() {
  const me = await currentRealMe();
  if (!me) throw new ApiError(401, 'not_signed_in', 'Sign in first.');
  if (!me.realPerson.appRoles.includes('admin')) throw forbidden('Only an admin can view as someone else.');
  return me;
}

export async function POST(req: Request) {
  try {
    sameOrigin(req);
    const me = await realAdmin();
    rateLimit(`view:${me.realPerson.id}`, 30);
    const { personId } = await readBody(req, z.object({ personId: z.string().min(1).max(80) }).strict());
    const res = Response.json({ ok: true });
    if (personId === me.realPerson.id) {
      res.headers.append('Set-Cookie', cookie('', 0, isHttps(req), VIEW_COOKIE));
      return res;
    }
    const target = await getPerson(await db(), me.team.id, personId);
    if (!target?.active) throw new ApiError(404, 'not_found', 'That person is not on the active roster.');
    res.headers.append('Set-Cookie', cookie(signView(me.realPerson.id, target.id), cookieOptions.maxAge, isHttps(req), VIEW_COOKIE));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    sameOrigin(req);
    const res = new Response(null, { status: 204 });
    res.headers.append('Set-Cookie', cookie('', 0, isHttps(req), VIEW_COOKIE));
    return res;
  } catch (e) {
    return errorResponse(e);
  }
}
