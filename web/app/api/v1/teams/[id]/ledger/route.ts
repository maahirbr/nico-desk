import { route, sameTeam } from '@/lib/http';
import { weekParam } from '@/lib/query';
import { addDays, mondayOf, today } from '@/lib/time';
import { ledgerFor } from '@/lib/visibility';

// The same scope as the Ledger page (lib/visibility.ts ledgerFor): a lead or an admin gets everyone, a member
// themselves and the people they work with. Rows are numbers only.
export const GET = route<{ id: string }>(async ({ req, params, me, db }) => {
  sameTeam(me, params.id);
  const q = new URL(req.url).searchParams;
  const to = weekParam(q.get('to') ?? mondayOf(today()), 'to');
  const from = weekParam(q.get('from') ?? addDays(to, -21), 'from');
  const { rows } = await ledgerFor(db, me, { from, to, prevFrom: from, prevTo: from, personId: q.get('personId') || undefined });
  return { rows };
});
