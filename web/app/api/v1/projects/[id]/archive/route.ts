import { route } from '@/lib/http';
import { archiveProject } from '@/lib/plan';
import { projectFor } from '@/lib/visibility';

// Archive a project. Refused while it has open work (the message says how much). Every non-GET goes through route(), so view-as stays read-only.
export const POST = route<{ id: string }>(async ({ params, me, db }) => {
  await projectFor(db, me, params.id);
  return archiveProject(db, me.person.id, params.id);
});
