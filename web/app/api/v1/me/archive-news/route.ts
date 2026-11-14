import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { markArchiveNewsSeen } from '@/lib/plan';

// Mark seen the answer to my ask to archive a project (Home).
const Body = z.object({ id: z.string().min(1).max(80) }).strict();

export const POST = route(async ({ req, me, db }) => {
  await markArchiveNewsSeen(db, me.person.id, (await readBody(req, Body)).id);
  return new Response(null, { status: 204 });
});
