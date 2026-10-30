import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { CLOSE_NOTE_MAX, setFeedbackStatus } from '@/lib/feedback';

// POST: mark a note Done, Not now (with a reason) or open again. Anyone on the team; View as refuses it in route().
export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, z.object({ status: z.enum(['open', 'done', 'not_now']), reason: z.string().max(CLOSE_NOTE_MAX + 200).optional() }).strict());
  return setFeedbackStatus(db, me, params.id, b.status, b.reason);
});
