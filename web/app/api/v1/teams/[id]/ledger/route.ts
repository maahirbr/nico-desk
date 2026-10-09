import { route, sameTeam } from '@/lib/http';
import { weekParam } from '@/lib/query';
import { ledger } from '@/lib/service';
import { addDays, mondayOf, today } from '@/lib/time';

export const GET = route<{ id: string }>(async ({ req, params, me, db }) => {
  sameTeam(me, params.id);
  const q = new URL(req.url).searchParams;
  const to = weekParam(q.get('to') ?? mondayOf(today()), 'to');
  const from = weekParam(q.get('from') ?? addDays(to, -21), 'from');
  return { rows: await ledger(db, params.id, from, to, q.get('personId') || undefined) };
});
