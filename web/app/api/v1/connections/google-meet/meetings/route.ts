import { forbidden } from '@/lib/errors';
import { assertNotViewing, route } from '@/lib/http';
import { listMeetMeetings, requireMeet } from '@/lib/meet';
import { isLeadOrAdmin } from '@/lib/roles';

// The signed-in lead's own recent Meet meetings, read with their own link.
export const GET = route(async ({ req, me, db }) => {
  requireMeet();
  assertNotViewing(me);
  if (!isLeadOrAdmin(me.person.appRoles)) throw forbidden('Only a lead can browse Google Meet. Paste the minutes instead.');
  const u = new URL(req.url).searchParams;
  return listMeetMeetings(db, me.realPerson.id, { days: Number(u.get('days') ?? 14) || 14, q: u.get('q')?.slice(0, 100) || undefined });
});
