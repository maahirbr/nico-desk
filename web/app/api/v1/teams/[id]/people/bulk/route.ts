import { z } from 'zod';
import { readBody, route, sameTeam } from '@/lib/http';
import { personFields } from '@/lib/personFields';
import { addPeople } from '@/lib/service';

const Row = personFields.strict();
const Body = z.object({ rows: z.array(Row).min(1).max(100) }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  sameTeam(me, params.id);
  const { rows } = await readBody(req, Body);
  return Response.json(await addPeople(db, me.person.id, params.id, rows), { status: 201 });
});
