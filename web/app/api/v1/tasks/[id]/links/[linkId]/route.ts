import { route, sameTeam } from '@/lib/http';
import { getTask, removeTaskLink } from '@/lib/service';

export const DELETE = route<{ id: string; linkId: string }>(async ({ params, me, db }) => {
  sameTeam(me, (await getTask(db, params.id)).teamId);
  await removeTaskLink(db, me.person.id, params.id, params.linkId);
  return new Response(null, { status: 204 });
});
