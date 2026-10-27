import { z } from 'zod';
import { meetingAgenda, MEET_EVERY, setMeetingRhythm } from '@/lib/meetings';
import { readBody, route, zDate } from '@/lib/http';
import { projectFor } from '@/lib/visibility';

// The meeting agenda for a project (GET), and its rhythm (PUT). Every non-GET goes through route(), so View as stays read-only.
// every: null clears the rhythm. day is an ISO weekday, 1 Monday to 7 Sunday. next is left out to let the server work it out.
const Body = z.object({
  every: z.enum(MEET_EVERY).nullable(),
  day: z.number().int().min(1).max(7).nullable().optional(),
  next: zDate.nullable().optional(),
});

export const GET = route<{ id: string }>(async ({ params, me, db }) => meetingAgenda(db, me, params.id));

export const PUT = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  await projectFor(db, me, params.id);
  return setMeetingRhythm(db, me.person.id, params.id, b);
});
