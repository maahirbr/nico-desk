import { requireMe } from '@/lib/auth';
import { lookups, one, type SP } from '@/lib/page';
import { ledger, ledgerTasks, teamTasks } from '@/lib/service';
import { addDays, isDate, mondayOf, today } from '@/lib/time';
import { LedgerView } from '@/components/LedgerView';

export const dynamic = 'force-dynamic';

// Leads and admins see everyone (SPEC.md roles); a member sees their own line only.
export default async function Ledger({ searchParams }: { searchParams: SP }) {
  const me = await requireMe();
  const sp = await searchParams;
  const weeks = Math.min(Math.max(Number(one(sp.weeks) ?? 4) || 4, 1), 26);
  const t = one(sp.to);
  const to = t && isDate(t) ? mondayOf(t) : mondayOf(today());
  const from = addDays(to, -7 * (weeks - 1));
  const prevFrom = addDays(from, -7 * weeks);
  const prevTo = addDays(from, -7);
  const { d, names, people, projectNames, isLead, isAdmin } = await lookups(me);
  const seeAll = isLead || isAdmin;
  const personId = seeAll ? one(sp.person) : me.person.id;
  const [rows, tasks, prev, all] = await Promise.all([
    ledger(d, me.team.id, from, to, personId),
    ledgerTasks(d, me.team.id, from, to, personId),
    ledgerTasks(d, me.team.id, prevFrom, prevTo, personId),
    teamTasks(d, me.team.id),
  ]);
  const shown = people.filter((p) => p.active && (!personId || p.id === personId));
  return (
    <LedgerView
      weeks={weeks} from={from} to={to} today={today()} rows={rows} tasks={tasks} prev={prev}
      openNow={all.filter((x) => x.statusCategory === 'open' && (!personId || x.ownerId === personId))}
      waitingOn={all.filter((x) => x.statusCategory === 'open' && x.blocked)}
      people={shown.map((p) => ({ id: p.id, name: p.displayName, role: p.role }))}
      names={names} projectNames={projectNames} seeAll={seeAll}
    />
  );
}
