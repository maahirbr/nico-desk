import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { askForUpdate, asksOnTask } from '@/lib/asks';

// GET: the open asks for an update on this task. POST: ask its owner for an update, with an optional question.
// In-app only; route() refuses the POST under View as.
export const GET = route<{ id: string }>(async ({ params, me, db }) => asksOnTask(db, me, params.id));

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const { question } = await readBody(req, z.object({ question: z.string().max(140).nullable().optional() }).strict());
  return askForUpdate(db, me, params.id, question ?? null);
});
