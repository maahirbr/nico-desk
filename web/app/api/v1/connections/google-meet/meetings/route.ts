import { assertNotViewing, route } from '@/lib/http';
import { listMeetMeetings, requireMeet } from '@/lib/meet';

// The signed-in person's own recent Meet meetings, read with their own link (anyone, since 15 Nov).
export const GET = route(async ({ req, me, db }) => {
  requireMeet();
  assertNotViewing(me);
  const u = new URL(req.url).searchParams;
  return listMeetMeetings(db, me.realPerson.id, { days: Number(u.get('days') ?? 14) || 14, q: u.get('q')?.slice(0, 100) || undefined });
});
