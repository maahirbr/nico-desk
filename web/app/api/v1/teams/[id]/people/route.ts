import { z } from 'zod';
import { readBody, route, sameTeam } from '@/lib/http';
import { personFields } from '@/lib/personFields';
import { addPerson } from '@/lib/service';

const Body = personFields.extend({
  appRoles: z.array(z.enum(['member', 'lead', 'admin'])).default([]),
}).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  sameTeam(me, params.id);
  return Response.json(await addPerson(db, me.person.id, params.id, await readBody(req, Body)), { status: 201 });
});
