import { assertNotViewing, route } from '@/lib/http';
import { readMeetMeeting, requireMeet } from '@/lib/meet';

export const GET = route<{ id: string }>(async ({ params, me, db }) => {
  requireMeet();
  assertNotViewing(me);
  return readMeetMeeting(db, me.realPerson.id, params.id);
});
