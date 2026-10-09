import { z } from 'zod';
import { readBody, route, sameTeam, zVersion } from '@/lib/http';
import { getTask, respondToCounter } from '@/lib/service';

// The asker accepts or declines the counter date.
const Body = z.object({ version: zVersion, accept: z.boolean(), reason: z.string().max(280).optional() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  sameTeam(me, (await getTask(db, params.id)).teamId);
  return respondToCounter(db, me.person.id, params.id, b);
});
