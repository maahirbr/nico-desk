import { z } from 'zod';
import { readBody, route, zVersion } from '@/lib/http';
import { closeTask } from '@/lib/service';
import { taskFor } from '@/lib/visibility';

const Body = z.object({ version: zVersion, as: z.enum(['done', 'dropped']), reason: z.string().optional() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  await taskFor(db, me, params.id);
  return closeTask(db, me.person.id, params.id, b);
});
