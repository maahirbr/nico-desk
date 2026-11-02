import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { personFields } from '@/lib/personFields';
import { patchPerson } from '@/lib/service';

const Body = z.object({
  displayName: personFields.shape.displayName.optional(),
  email: personFields.shape.email.optional(),
  active: z.boolean().optional(),
  appRoles: z.array(z.enum(['member', 'lead', 'admin'])).optional(),
  role: personFields.shape.role.optional(),
  department: personFields.shape.department.optional(),
  restricted: z.boolean().optional(),
  repliesFeedback: z.boolean().optional(),
}).strict();

export const PATCH = route<{ id: string }>(async ({ req, params, me, db }) =>
  patchPerson(db, me.person.id, me.team.id, params.id, await readBody(req, Body)),
);
