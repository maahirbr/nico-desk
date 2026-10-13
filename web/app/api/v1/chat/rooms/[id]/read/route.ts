import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { markRead } from '@/lib/teamchat';

// Moves this person's read mark up to the last message they were shown (upTo), or to the newest in the room.
export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const { upTo } = await readBody(req, z.object({ upTo: z.string().max(80).optional() }).strict());
  await markRead(db, me, params.id, upTo);
  return new Response(null, { status: 204 });
});
