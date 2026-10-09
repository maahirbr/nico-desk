import { route, sameTeam } from '@/lib/http';
import { filters, weekParam } from '@/lib/query';
import { weekView } from '@/lib/service';

export const GET = route<{ id: string }>(async ({ req, params, me, db }) => {
  sameTeam(me, params.id);
  const q = new URL(req.url).searchParams;
  return weekView(db, params.id, weekParam(q.get('weekStart')), filters(q));
});
