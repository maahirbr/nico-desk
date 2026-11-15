import { z } from 'zod';
import { assertNotViewing, rateLimit, readBody, route } from '@/lib/http';
import { readGoogleDoc, requireMeet } from '@/lib/meet';

// A Google Doc of minutes, read with the signed-in person's own Google link (anyone, since 15 Nov). POST so the Doc link stays out of the
// address, where request logs would keep it.
const Body = z.object({ link: z.string().trim().min(1).max(500) });

export const POST = route(async ({ req, me, db }) => {
  requireMeet();
  assertNotViewing(me);
  rateLimit(`google-doc:${me.realPerson.id}`, 20);
  const { link } = await readBody(req, Body);
  return readGoogleDoc(db, me.realPerson.id, link);
});
