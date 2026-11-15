import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { archiveProject } from '@/lib/plan';
import { projectFor } from '@/lib/visibility';

// Archive a project, with a reason (required since 15 Nov). Refused while it has open work (the message says how much),
// unless dropOpen is true: then the open work is dropped with that reason and the project archived in one step.
// The older form, dropOpen as the reason text, still works. Every non-GET goes through route(), so view-as stays read-only.
const Body = z.object({ reason: z.string().max(280).optional(), dropOpen: z.union([z.string().max(280), z.boolean()]).optional() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = req.headers.get('content-type')?.includes('json') ? await readBody(req, Body) : {};
  await projectFor(db, me, params.id);
  const drop = typeof b.dropOpen === 'string' ? b.dropOpen : b.dropOpen ? (b.reason ?? '') : undefined;
  return archiveProject(db, me.person.id, params.id, drop, b.reason);
});
