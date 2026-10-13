import { z } from 'zod';
import { readBody, route, zVersion } from '@/lib/http';
import { reopenTask } from '@/lib/service';
import { taskFor } from '@/lib/visibility';

const Body = z.object({ version: zVersion, reason: z.string() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  await taskFor(db, me, params.id);
  return reopenTask(db, me.person.id, params.id, b);
});
