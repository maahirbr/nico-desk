import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { markNewsSeen } from '@/lib/news';

// Got it on the What's new note (lib/news.ts). Refused under View as, like every write.
const Body = z.object({ id: z.string().min(1).max(80) }).strict();

export const POST = route(async ({ req, me, db }) => {
  const { id } = await readBody(req, Body);
  await markNewsSeen(db, me.person.id, id);
  return new Response(null, { status: 204 });
});
