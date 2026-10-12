import { route, sameTeam } from '@/lib/http';
import { getProject, restoreProject } from '@/lib/plan';

export const POST = route<{ id: string }>(async ({ params, me, db }) => {
  sameTeam(me, (await getProject(db, params.id)).teamId);
  return restoreProject(db, me.person.id, params.id);
});
