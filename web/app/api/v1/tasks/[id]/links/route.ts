import { z } from 'zod';
import { readBody, route, sameTeam } from '@/lib/http';
import { addTaskLink, getTask } from '@/lib/service';

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, z.object({ url: z.string().max(2000), label: z.string().max(80).nullable().optional() }).strict());
  sameTeam(me, (await getTask(db, params.id)).teamId);
  return addTaskLink(db, me.person.id, params.id, b);
});
