import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { markUpdatesSeen } from '@/lib/service';

// Mark "Updates for you" seen: everything (no task ids), one project's tasks, or a task just opened.
const Body = z.object({ taskIds: z.array(z.string().min(1).max(80)).max(200).optional(), upTo: z.string().max(40).optional() }).strict();

export const POST = route(async ({ req, me, db }) => {
  await markUpdatesSeen(db, me.person.id, me.team.id, await readBody(req, Body));
  return new Response(null, { status: 204 });
});
