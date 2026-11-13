import { cookie, isHttps } from '@/lib/auth';
import { forbidden } from '@/lib/errors';
import { assertNotViewing, rateLimit, route } from '@/lib/http';
import { GMAIL_CALLBACK_PATH, GMAIL_STATE_COOKIE, gmailAuthUrl, gmailStatus, requireGmailSend } from '@/lib/gmailSend';
import { disconnectMeet, newNonce, signState } from '@/lib/meet';
import { isLeadOrAdmin } from '@/lib/roles';

// Gmail send is one lead's own link, so every call here is about the signed-in person and nobody else.
const lead = (roles: string[]) => { if (!isLeadOrAdmin(roles)) throw forbidden('Only a lead can connect Gmail.'); };

export const GET = route(async ({ me, db }) => {
  requireGmailSend();
  assertNotViewing(me);
  return gmailStatus(db, me.realPerson.id);
});

// Starts the connect: a signed state bound to this person and to a cookie in this browser, then the Google address.
export const POST = route(async ({ req, me }) => {
  requireGmailSend();
  lead(me.person.appRoles);
  rateLimit(`gmail-start:${me.realPerson.id}`, 10);
  const nonce = newNonce();
  const url = gmailAuthUrl(`${new URL(req.url).origin}${GMAIL_CALLBACK_PATH}`, signState(me.realPerson.id, nonce));
  return new Response(JSON.stringify({ url }), {
    headers: { 'content-type': 'application/json', 'Set-Cookie': cookie(nonce, 600, isHttps(req), GMAIL_STATE_COOKIE) },
  });
});

// One Google grant per person: this removes the shared link, so Google Meet stops too.
export const DELETE = route(async ({ me, db }) => {
  requireGmailSend();
  lead(me.person.appRoles);
  await disconnectMeet(db, me.realPerson.id);
  return gmailStatus(db, me.realPerson.id);
});
