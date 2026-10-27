import { cookie, isHttps } from '@/lib/auth';
import { forbidden } from '@/lib/errors';
import { assertNotViewing, rateLimit, route } from '@/lib/http';
import { disconnectMeet, MEET_CALLBACK_PATH, MEET_STATE_COOKIE, meetAuthUrl, meetStatus, newNonce, requireMeet, signState } from '@/lib/meet';
import { isLeadOrAdmin } from '@/lib/roles';

// Google Meet is one lead's own link, so every call here is about the signed-in person and nobody else.
// Under View as these are refused, reads too: the link would otherwise let an admin read a lead's meetings.
const lead = (roles: string[]) => { if (!isLeadOrAdmin(roles)) throw forbidden('Only a lead can connect Google Meet.'); };

export const GET = route(async ({ me, db }) => {
  requireMeet();
  assertNotViewing(me);
  return meetStatus(db, me.realPerson.id);
});

// Starts the connect: a signed state bound to this person and to a cookie in this browser, then the Google address.
export const POST = route(async ({ req, me }) => {
  requireMeet();
  lead(me.person.appRoles);
  rateLimit(`meet-start:${me.realPerson.id}`, 10);
  const nonce = newNonce();
  const url = meetAuthUrl(`${new URL(req.url).origin}${MEET_CALLBACK_PATH}`, signState(me.realPerson.id, nonce));
  return new Response(JSON.stringify({ url }), {
    headers: { 'content-type': 'application/json', 'Set-Cookie': cookie(nonce, 600, isHttps(req), MEET_STATE_COOKIE) },
  });
});

export const DELETE = route(async ({ me, db }) => {
  requireMeet();
  lead(me.person.appRoles);
  await disconnectMeet(db, me.realPerson.id);
  return meetStatus(db, me.realPerson.id);
});
