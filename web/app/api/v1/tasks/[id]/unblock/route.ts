import { z } from 'zod';
import { readBody, route, zVersion } from '@/lib/http';
import { unblockTask } from '@/lib/service';
import { taskFor } from '@/lib/visibility';

const Body = z.object({ version: zVersion, note: z.string().max(280).optional(), resume: z.boolean().optional() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  await taskFor(db, me, params.id);
  return unblockTask(db, me.person.id, params.id, b);
});
