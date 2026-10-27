import { z } from 'zod';
import { FEEDBACK_MAX, listFeedback, sendFeedback } from '@/lib/feedback';
import { readBody, route } from '@/lib/http';

// POST: any signed-in person sends a note. GET: the team's notes, for everyone on the team. Nothing is emailed.
export const GET = route(({ me, db }) => listFeedback(db, me));

export const POST = route(async ({ req, me, db }) => {
  const input = await readBody(req, z.object({ body: z.string().max(FEEDBACK_MAX + 200), path: z.string().max(500).nullish() }).strict());
  return sendFeedback(db, me, input);
});
