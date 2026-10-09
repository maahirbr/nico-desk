import { z } from 'zod';
import { readBody, route, sameTeam, zVersion } from '@/lib/http';
import { getTask, closeTask } from '@/lib/service';

const Body = z.object({ version: zVersion, as: z.enum(['done', 'dropped']), reason: z.string().optional() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  sameTeam(me, (await getTask(db, params.id)).teamId);
  return closeTask(db, me.person.id, params.id, b);
});
