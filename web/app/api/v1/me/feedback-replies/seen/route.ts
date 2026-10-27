import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { markRepliesSeen } from '@/lib/feedback';

// POST: marks replies to my own notes seen (all, or the ids given). Used by Home's card and by opening Feedback.
export const POST = route(async ({ req, me, db }) => {
  const b = await readBody(req, z.object({ ids: z.array(z.string().max(80)).max(50).optional() }).strict());
  return markRepliesSeen(db, me, b.ids);
});
