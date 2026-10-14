import { z } from 'zod';
import { readBody, route, sameTeam } from '@/lib/http';
import { addPerson } from '@/lib/service';

const Body = z.object({
  displayName: z.string().trim().min(2).max(80),
  role: z.string().trim().min(2).max(80),
  department: z.string().trim().min(2).max(80),
  email: z.email(),
  appRoles: z.array(z.enum(['member', 'lead', 'admin'])).default([]),
}).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  sameTeam(me, params.id);
  return Response.json(await addPerson(db, me.person.id, params.id, await readBody(req, Body)), { status: 201 });
});
