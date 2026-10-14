import { z } from 'zod';
import { readBody, route, sameTeam, zDate, zVersion } from '@/lib/http';
import { getTask, renegotiate } from '@/lib/service';

const Body = z.object({ version: zVersion, newDueOn: zDate, reason: z.string() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  sameTeam(me, (await getTask(db, params.id)).teamId);
  return renegotiate(db, me.person.id, params.id, b);
});
