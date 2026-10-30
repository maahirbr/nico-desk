import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { markFeedbackNewsSeen } from '@/lib/feedback';

// POST: marks my feedback news seen (all, or the ids given): replies, Done, Not now and Reopen on notes I wrote or gave
// +1. Used by Home's card and by opening Feedback.
export const POST = route(async ({ req, me, db }) => {
  const b = await readBody(req, z.object({ ids: z.array(z.string().max(80)).max(50).optional() }).strict());
  return markFeedbackNewsSeen(db, me, b.ids);
});
