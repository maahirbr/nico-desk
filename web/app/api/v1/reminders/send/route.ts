import { z } from 'zod';
import { rateLimit, readBody, route } from '@/lib/http';
import { notFound } from '@/lib/errors';
import { gmailSendEnabled, gmailStatus, sendAsPerson } from '@/lib/gmailSend';
import { resendSendEnabled, sendViaResend } from '@/lib/resendSend';
import { assertOnTeam, assertStillOpen, logReminder, mayRemind } from '@/lib/reminders';

// Sends one reminder: from the lead's own Gmail when they connected it, else through Resend when that is on (18 Nov).
// The lead's press of Send is the yes; nothing else calls this. route() refuses it under View as, like every non-GET call.
const Addr = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254));
const Body = z.object({
  personId: z.string().min(1).max(80),
  to: z.array(Addr).min(1).max(10), cc: z.array(Addr).max(10), bcc: z.array(Addr).max(10),
  subject: z.string().trim().min(1).max(200), html: z.string().max(50_000), text: z.string().trim().min(1).max(20_000),
  itemKeys: z.array(z.string().min(1).max(120)).max(500),
}).strict();

export const POST = route(async ({ req, me, db }) => {
  const gmailOn = gmailSendEnabled();
  const resendOn = resendSendEnabled();
  if (!gmailOn && !resendOn) throw notFound();
  mayRemind(me.person.appRoles);
  rateLimit(`gmail-send:${me.realPerson.id}`, 20);
  const b = await readBody(req, Body);
  await assertOnTeam(db, me.team.id, b.personId); // before anything goes out
  await assertStillOpen(db, b.itemKeys); // and nothing in it was finished, dropped or archived since the page opened
  const fromName = me.realPerson.fullName ?? me.realPerson.displayName;
  const mail = { fromName, to: b.to, cc: b.cc, bcc: b.bcc, subject: b.subject, html: b.html, text: b.text };
  // A connected Gmail wins. Without Resend, sendAsPerson refuses with "Gmail is not connected", as before.
  const viaGmail = gmailOn && (await gmailStatus(db, me.realPerson.id)).connected;
  const { from } = viaGmail || !resendOn
    ? await sendAsPerson(db, me.realPerson.id, mail)
    : await sendViaResend({ ...mail, replyTo: me.realPerson.email });
  await logReminder(db, me.team.id, me.person.id, { personId: b.personId, channel: 'sent', subject: b.subject, itemCount: b.itemKeys.length, itemKeys: b.itemKeys });
  return { sent: true, from };
});
