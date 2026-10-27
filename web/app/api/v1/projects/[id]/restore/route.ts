import { route } from '@/lib/http';
import { restoreProject } from '@/lib/plan';
import { projectFor } from '@/lib/visibility';

export const POST = route<{ id: string }>(async ({ params, me, db }) => {
  await projectFor(db, me, params.id);
  return restoreProject(db, me.person.id, params.id);
});
