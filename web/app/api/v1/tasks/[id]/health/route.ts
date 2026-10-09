import { z } from 'zod';
import { readBody, route, sameTeam, zDate, zVersion } from '@/lib/http';
import { getTask, setHealth } from '@/lib/service';

const Body = z.object({ version: zVersion, health: z.enum(['not_started', 'on_track']), reason: z.string().optional() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  sameTeam(me, (await getTask(db, params.id)).teamId);
  return setHealth(db, me.person.id, params.id, b);
});
