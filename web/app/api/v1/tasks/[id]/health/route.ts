import { z } from 'zod';
import { readBody, route, zDate, zVersion } from '@/lib/http';
import { setHealth } from '@/lib/service';
import { taskFor } from '@/lib/visibility';

const Body = z.object({ version: zVersion, health: z.enum(['not_started', 'on_track']), reason: z.string().optional() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  await taskFor(db, me, params.id);
  return setHealth(db, me.person.id, params.id, b);
});
