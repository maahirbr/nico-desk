import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { archiveProject } from '@/lib/plan';
import { projectFor } from '@/lib/visibility';

// Archive a project. Refused while it has open work (the message says how much), unless the body gives a reason in
// dropOpen: then the open work is dropped with that reason and the project archived in one step.
// Every non-GET goes through route(), so view-as stays read-only.
const Body = z.object({ dropOpen: z.string().max(280).optional() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = req.headers.get('content-type')?.includes('json') ? await readBody(req, Body) : {};
  await projectFor(db, me, params.id);
  return archiveProject(db, me.person.id, params.id, b.dropOpen);
});
