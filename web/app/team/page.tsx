import { requireMe } from '@/lib/auth';
import { lookups, one, type SP } from '@/lib/page';
import { teamProjects } from '@/lib/plan';
import { asOfTasks, asOfWeeks, teamTasks, weeklyLoad } from '@/lib/service';
import { addDays, isDate, istDate, mondayOf, today } from '@/lib/time';
import { TeamView } from '@/components/TeamView';
import { AsOfBar, LoadPanel } from '@/components/TeamV2';

export const dynamic = 'force-dynamic';

// The team's week. By person: what is next for each person (overdue, this week, coming up).
// By status: the week's work, done included.
export default async function Team({ searchParams }: { searchParams: SP }) {
  const me = await requireMe();
  const sp = await searchParams;
  const w = one(sp.week);
  const real = today();
  // v2: ?asof=<Monday> shows the desk as it stood at the end of that week, from the events log. Read only.
  const weeks = asOfWeeks(real);
  const asOfParam = one(sp.asof);
  const asOf = asOfParam && weeks.includes(asOfParam) ? asOfParam : null;
  const t = asOf ? addDays(asOf, 6) : real;
  const weekStart = asOf ?? (w && isDate(w) ? mondayOf(w) : mondayOf(t));
  const view = one(sp.view) === 'status' ? 'status' : 'person';
  const weekEnd = addDays(weekStart, 6);
  const { d, names, people, projectNames, activeOpts, isLead } = await lookups(me);
  const [all, projects] = await Promise.all([asOf ? asOfTasks(d, me.team.id, asOf) : teamTasks(d, me.team.id), teamProjects(d, me.team.id)]);
  const active = people.filter((p) => p.active);
  // In view: open work due by the end of the week (so overdue too), and anything closed during it.
  const tasks = all.filter((x) =>
    (x.statusCategory === 'open' && x.dueOn <= weekEnd) ||
    (x.statusCategory === 'done' && x.closedAt && istDate(x.closedAt) >= weekStart && istDate(x.closedAt) <= weekEnd));
  // Coming up after this week, so each person's card looks ahead, not only at the week.
  const later = all.filter((x) => x.statusCategory === 'open' && x.dueOn > weekEnd);
  return (
    <TeamView
      tasks={tasks} later={later} weekStart={weekStart} thisWeek={mondayOf(real)} today={t} view={view} asOf={asOf}
      extra={<><AsOfBar weeks={weeks} asOf={asOf} view={view} /><LoadPanel load={weeklyLoad(all, active.map((p) => p.id), weekStart)} names={names} weekStart={weekStart} today={t} /></>}
      people={active.map((p) => ({ id: p.id, name: p.displayName, role: p.role }))}
      names={names} projectNames={projectNames} projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      workstreamsByProject={Object.fromEntries(projects.map((p) => [p.id, p.workstreams]))}
      meId={me.person.id} isLead={isLead} opts={activeOpts}
    />
  );
}
