import { route, sameTeam } from '@/lib/http';
import { archiveProject, getProject } from '@/lib/plan';

// Archive a project. Refused while it has open work (the message says how much). Every non-GET goes through route(), so view-as stays read-only.
export const POST = route<{ id: string }>(async ({ params, me, db }) => {
  sameTeam(me, (await getProject(db, params.id)).teamId);
  return archiveProject(db, me.person.id, params.id);
});
