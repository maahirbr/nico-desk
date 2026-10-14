import { z } from 'zod';
import { readBody, route, sameTeam, zVersion } from '@/lib/http';
import { getTask, setPriority } from '@/lib/service';

const Body = z.object({ version: zVersion, value: z.enum(['high', 'normal', 'low']) }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  sameTeam(me, (await getTask(db, params.id)).teamId);
  return setPriority(db, me.person.id, params.id, b);
});
