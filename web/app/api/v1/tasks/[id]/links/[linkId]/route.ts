import { route } from '@/lib/http';
import { removeTaskLink } from '@/lib/service';
import { taskFor } from '@/lib/visibility';

export const DELETE = route<{ id: string; linkId: string }>(async ({ params, me, db }) => {
  await taskFor(db, me, params.id);
  await removeTaskLink(db, me.person.id, params.id, params.linkId);
  return new Response(null, { status: 204 });
});
