import { forbidden } from '@/lib/errors';
import { assertNotViewing, route } from '@/lib/http';
import { readMeetMeeting, requireMeet } from '@/lib/meet';
import { isLeadOrAdmin } from '@/lib/roles';

export const GET = route<{ id: string }>(async ({ params, me, db }) => {
  requireMeet();
  assertNotViewing(me);
  if (!isLeadOrAdmin(me.person.appRoles)) throw forbidden('Only a lead can read Google Meet. Paste the minutes instead.');
  return readMeetMeeting(db, me.realPerson.id, params.id);
});
