import { z } from 'zod';
import { readBody, route, zDate, zVersion } from '@/lib/http';
import { renegotiate } from '@/lib/service';
import { taskFor } from '@/lib/visibility';

const Body = z.object({ version: zVersion, newDueOn: zDate, reason: z.string() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  await taskFor(db, me, params.id);
  return renegotiate(db, me.person.id, params.id, b);
});
