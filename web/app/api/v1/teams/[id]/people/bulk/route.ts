import { z } from 'zod';
import { readBody, route, sameTeam } from '@/lib/http';
import { addPeople } from '@/lib/service';

const Row = z.object({
  displayName: z.string().trim().min(2).max(80),
  role: z.string().trim().min(2).max(80),
  department: z.string().trim().min(2).max(80),
  email: z.email(),
}).strict();
const Body = z.object({ rows: z.array(Row).min(1).max(100) }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  sameTeam(me, params.id);
  const { rows } = await readBody(req, Body);
  return Response.json(await addPeople(db, me.person.id, params.id, rows), { status: 201 });
});
