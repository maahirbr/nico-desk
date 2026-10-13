import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { CHAT_MAX, deleteMessage, editMessage } from '@/lib/teamchat';

// PATCH: change a message. DELETE: remove it (the room then reads "Message removed"). Only the author, for both.
export const PATCH = route<{ id: string }>(async ({ req, params, me, db }) => {
  const { body } = await readBody(req, z.object({ body: z.string().max(CHAT_MAX + 200) }).strict());
  return editMessage(db, me, params.id, body);
});

export const DELETE = route<{ id: string }>(async ({ params, me, db }) => {
  await deleteMessage(db, me, params.id);
  return new Response(null, { status: 204 });
});
