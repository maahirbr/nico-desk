import { route, sameTeam } from '@/lib/http';
import { filters, weekParam } from '@/lib/query';
import { byStatus } from '@/lib/service';
import { assertSeesAll } from '@/lib/visibility';

export const GET = route<{ id: string }>(async ({ req, params, me, db }) => {
  sameTeam(me, params.id);
  await assertSeesAll(db, me);
  const q = new URL(req.url).searchParams;
  return byStatus(db, params.id, weekParam(q.get('weekStart')), filters(q));
});
