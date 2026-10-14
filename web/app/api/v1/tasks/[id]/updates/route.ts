import { z } from 'zod';
import { readBody, route, sameTeam } from '@/lib/http';
import { addUpdate, getTask } from '@/lib/service';

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const { text } = await readBody(req, z.object({ text: z.string().max(280) }).strict());
  sameTeam(me, (await getTask(db, params.id)).teamId);
  await addUpdate(db, me.person.id, params.id, text);
  return new Response(null, { status: 204 });
});
