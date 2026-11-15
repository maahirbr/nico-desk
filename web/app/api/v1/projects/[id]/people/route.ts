import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { addProjectPeople } from '@/lib/plan';
import { projectFor } from '@/lib/visibility';

// Add people to a project (15 Nov): anyone on it may; only adds (lib/plan.ts addProjectPeople). Refused under View as.
const Body = z.object({ members: z.array(z.object({ personId: z.string().min(1).max(80), role: z.string().max(60) }).strict()).min(1).max(50) }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  await projectFor(db, me, params.id);
  return addProjectPeople(db, me.person.id, params.id, b.members);
});
