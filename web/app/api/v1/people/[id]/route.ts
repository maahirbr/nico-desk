import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { patchPerson } from '@/lib/service';

const Body = z.object({
  active: z.boolean().optional(),
  appRoles: z.array(z.enum(['member', 'lead', 'admin'])).optional(),
  role: z.string().trim().min(2).max(80).optional(),
  department: z.string().trim().min(2).max(60).optional(),
}).strict();

export const PATCH = route<{ id: string }>(async ({ req, params, me, db }) =>
  patchPerson(db, me.person.id, me.team.id, params.id, await readBody(req, Body)),
);
