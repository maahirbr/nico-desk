import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { CHAT_MAX, listMessages, postMessage } from '@/lib/teamchat';

// GET: the newest page of a room, oldest first. ?before=<message id> pages further back, ?limit= sets the page size.
// A room the person cannot see reads as 404. POST: write a message.
export const GET = route<{ id: string }>(async ({ req, params, me, db }) => {
  const q = new URL(req.url).searchParams;
  const limit = q.get('limit');
  return listMessages(db, me, params.id, { before: q.get('before') ?? undefined, limit: limit ? Number(limit) || undefined : undefined });
});

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const { body } = await readBody(req, z.object({ body: z.string().max(CHAT_MAX + 200) }).strict());
  return Response.json(await postMessage(db, me, params.id, body), { status: 201 });
});
