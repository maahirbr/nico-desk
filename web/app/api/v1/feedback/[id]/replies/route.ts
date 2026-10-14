import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { REPLY_MAX, replyFeedback } from '@/lib/feedback';

// POST: a reply to a note, only from someone the Roster lets reply. View as refuses it in route().
export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, z.object({ body: z.string().max(REPLY_MAX + 200) }).strict());
  return replyFeedback(db, me, params.id, b.body);
});
