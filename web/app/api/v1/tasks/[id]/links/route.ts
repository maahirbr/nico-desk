import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { addTaskLink } from '@/lib/service';
import { taskFor } from '@/lib/visibility';

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, z.object({ url: z.string().max(2000), label: z.string().max(80).nullable().optional() }).strict());
  await taskFor(db, me, params.id);
  return addTaskLink(db, me.person.id, params.id, b);
});
