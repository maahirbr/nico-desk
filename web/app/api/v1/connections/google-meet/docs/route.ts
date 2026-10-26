import { z } from 'zod';
import { forbidden } from '@/lib/errors';
import { assertNotViewing, rateLimit, readBody, route } from '@/lib/http';
import { readGoogleDoc, requireMeet } from '@/lib/meet';
import { isLeadOrAdmin } from '@/lib/roles';

// A Google Doc of minutes, read with the signed-in lead's own Google link. POST so the Doc link stays out of the
// address, where request logs would keep it.
const Body = z.object({ link: z.string().trim().min(1).max(500) });

export const POST = route(async ({ req, me, db }) => {
  requireMeet();
  assertNotViewing(me);
  if (!isLeadOrAdmin(me.person.appRoles)) throw forbidden('Only a lead can read a Google Doc. Paste the minutes instead.');
  rateLimit(`google-doc:${me.realPerson.id}`, 20);
  const { link } = await readBody(req, Body);
  return readGoogleDoc(db, me.realPerson.id, link);
});
