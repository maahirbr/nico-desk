import { z } from 'zod';
import { rateLimit, readBody, route } from '@/lib/http';
import { requireGmailSend, sendAsPerson } from '@/lib/gmailSend';
import { assertOnTeam, logReminder, mayRemind } from '@/lib/reminders';

// Sends one reminder from the lead's own Gmail. The lead's press of Send is the yes; nothing else calls this.
// route() refuses it under View as, like every non-GET call.
const Addr = z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254));
const Body = z.object({
  personId: z.string().min(1).max(80),
  to: z.array(Addr).min(1).max(10), cc: z.array(Addr).max(10), bcc: z.array(Addr).max(10),
  subject: z.string().trim().min(1).max(200), html: z.string().max(50_000), text: z.string().trim().min(1).max(20_000),
  itemKeys: z.array(z.string().min(1).max(120)).max(500),
}).strict();

export const POST = route(async ({ req, me, db }) => {
  requireGmailSend();
  mayRemind(me.person.appRoles);
  rateLimit(`gmail-send:${me.realPerson.id}`, 20);
  const b = await readBody(req, Body);
  await assertOnTeam(db, me.team.id, b.personId); // before anything goes out
  const { from } = await sendAsPerson(db, me.realPerson.id, {
    fromName: me.realPerson.fullName ?? me.realPerson.displayName, to: b.to, cc: b.cc, bcc: b.bcc, subject: b.subject, html: b.html, text: b.text,
  });
  await logReminder(db, me.team.id, me.person.id, { personId: b.personId, channel: 'sent', subject: b.subject, itemCount: b.itemKeys.length, itemKeys: b.itemKeys });
  return { sent: true, from };
});
