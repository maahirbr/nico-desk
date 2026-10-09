import { z } from 'zod';
import { readBody, route, sameTeam, zVersion } from '@/lib/http';
import { getTask, blockTask } from '@/lib/service';

const Body = z.object({ version: zVersion, onId: z.string().nullable().optional(), ask: z.string() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  sameTeam(me, (await getTask(db, params.id)).teamId);
  return blockTask(db, me.person.id, params.id, b);
});
