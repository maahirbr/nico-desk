import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { addUpdate } from '@/lib/service';
import { taskFor } from '@/lib/visibility';

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const { text } = await readBody(req, z.object({ text: z.string().max(280) }).strict());
  await taskFor(db, me, params.id);
  await addUpdate(db, me.person.id, params.id, text);
  return new Response(null, { status: 204 });
});
