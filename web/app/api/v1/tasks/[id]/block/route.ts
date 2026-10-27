import { z } from 'zod';
import { readBody, route, zVersion } from '@/lib/http';
import { blockTask } from '@/lib/service';
import { taskFor } from '@/lib/visibility';

const Body = z.object({ version: zVersion, onId: z.string().nullable().optional(), ask: z.string() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  await taskFor(db, me, params.id);
  return blockTask(db, me.person.id, params.id, b);
});
