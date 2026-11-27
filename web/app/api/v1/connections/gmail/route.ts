import { cookie, isHttps } from '@/lib/auth';
import { forbidden } from '@/lib/errors';
import { assertNotViewing, rateLimit, route } from '@/lib/http';
import { GMAIL_CALLBACK_PATH, GMAIL_STATE_COOKIE, gmailAuthUrl, gmailStatus, requireGmailSend } from '@/lib/gmailSend';
import { disconnectMeet, newNonce, signState } from '@/lib/meet';
import { mayRemindAny, remindAccess } from '@/lib/reminders';

// Gmail send is one lead's own link, so every call here is about the signed-in person and nobody else.
// Whoever may send reminders may connect Gmail to send them (27 Nov: a project's owner or lead too).
const lead = async (db: Parameters<typeof remindAccess>[0], me: { team: { id: string }; person: { id: string; appRoles: string[] } }) => {
  if (!mayRemindAny(await remindAccess(db, me.team.id, me.person.id, me.person.appRoles))) throw forbidden('Only leadership, an admin, or a project’s owner or lead can connect Gmail for reminders.');
};

export const GET = route(async ({ me, db }) => {
  requireGmailSend();
  assertNotViewing(me);
  return gmailStatus(db, me.realPerson.id);
});

// Starts the connect: a signed state bound to this person and to a cookie in this browser, then the Google address.
export const POST = route(async ({ req, me, db }) => {
  requireGmailSend();
  await lead(db, me);
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
  await lead(db, me);
  await disconnectMeet(db, me.realPerson.id);
  return gmailStatus(db, me.realPerson.id);
});
