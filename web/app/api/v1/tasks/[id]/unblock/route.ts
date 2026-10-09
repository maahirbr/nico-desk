import { z } from 'zod';
import { readBody, route, sameTeam, zVersion } from '@/lib/http';
import { getTask, unblockTask } from '@/lib/service';

const Body = z.object({ version: zVersion, note: z.string().max(280).optional() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  sameTeam(me, (await getTask(db, params.id)).teamId);
  return unblockTask(db, me.person.id, params.id, b);
});
