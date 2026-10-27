import { requireMe } from '@/lib/auth';
import { lookups, one, type SP } from '@/lib/page';
import { listProjects } from '@/lib/service';
import { ledgerFor } from '@/lib/visibility';
import { addDays, isDate, mondayOf, today } from '@/lib/time';
import { LedgerView } from '@/components/LedgerView';

export const dynamic = 'force-dynamic';

// Leads and admins see everyone, whatever the project; a member sees themselves and the people they work with,
// with the tasks they may not open counted only (lib/visibility.ts ledgerFor).
export default async function Ledger({ searchParams }: { searchParams: SP }) {
  const me = await requireMe();
  const sp = await searchParams;
  const weeks = Math.min(Math.max(Number(one(sp.weeks) ?? 4) || 4, 1), 26);
  const t = one(sp.to);
  const to = t && isDate(t) ? mondayOf(t) : mondayOf(today());
  const from = addDays(to, -7 * (weeks - 1));
  const { d, names, people, projectNames } = await lookups(me);
  const l = await ledgerFor(d, me, { from, to, prevFrom: addDays(from, -7 * weeks), prevTo: addDays(from, -7), personId: one(sp.person) });
  // A lead or an admin reads every task here, so every project name too.
  const pNames = l.all ? Object.fromEntries((await listProjects(d, me.team.id)).map((p) => [p.id, p.name])) : projectNames;
  const shown = people.filter((p) => p.active && (!l.people || l.people.has(p.id)) && (!one(sp.person) || p.id === one(sp.person)));
  return (
    <LedgerView
      weeks={weeks} from={from} to={to} today={today()} rows={l.rows} tasks={l.tasks} prev={l.prev}
      openNow={l.openNow} waitingOn={l.waitingOn} countOnly={l.countOnly} noLink={l.noLink}
      people={shown.map((p) => ({ id: p.id, name: p.displayName, role: p.role }))}
      names={names} projectNames={pNames} seeAll={l.all}
    />
  );
}
