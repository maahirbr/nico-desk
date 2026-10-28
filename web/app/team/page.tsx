import { requireMe } from '@/lib/auth';
import { lookups, one, type SP } from '@/lib/page';
import { seenProjects, seenTasks } from '@/lib/visibility';
import { addDays, isDate, istDate, istInstant, mondayOf, today } from '@/lib/time';
import { addedSince } from '@/lib/derive';
import { TeamView } from '@/components/TeamView';

export const dynamic = 'force-dynamic';

// The team's week. By person: what is next for each person (overdue, this week, coming up).
// By status: the week's work, done included. With ?added= (India time), every task made since then, any week.
export default async function Team({ searchParams }: { searchParams: SP }) {
  const me = await requireMe();
  const sp = await searchParams;
  const w = one(sp.week);
  const t = today();
  const weekStart = w && isDate(w) ? mondayOf(w) : mondayOf(t);
  const weekEnd = addDays(weekStart, 6);
  // Updates for you live on Home only: they are about your own tasks, and this page is the team's.
  const { d, sight, names, people, projectNames, activeOpts, isLead } = await lookups(me);
  const [all, projects] = await Promise.all([seenTasks(d, me, undefined, sight), seenProjects(d, me, sight)]);
  // In view: open work due by the end of the week (so overdue too), and anything closed during it.
  const tasks = all.filter((x) =>
    (x.statusCategory === 'open' && x.dueOn <= weekEnd) ||
    (x.statusCategory === 'done' && x.closedAt && istDate(x.closedAt) >= weekStart && istDate(x.closedAt) <= weekEnd));
  // Coming up after this week, so each person's card looks ahead, not only at the week.
  const later = all.filter((x) => x.statusCategory === 'open' && x.dueOn > weekEnd);
  const added = istInstant(one(sp.added)) ? one(sp.added)! : null;
  return (
    <TeamView
      tasks={added ? addedSince(all, istInstant(added)!) : tasks} later={added ? [] : later} added={added} weekStart={weekStart} thisWeek={mondayOf(t)} today={t} view={one(sp.view) === 'status' ? 'status' : 'person'}
      people={people.filter((p) => p.active).map((p) => ({ id: p.id, name: p.displayName, role: p.role }))}
      names={names} projectNames={projectNames} projects={projects.filter((p) => !p.archivedAt).map((p) => ({ id: p.id, name: p.name }))}
      workstreamsByProject={Object.fromEntries(projects.map((p) => [p.id, p.workstreams]))}
      meId={me.person.id} isLead={isLead} opts={activeOpts}
    />
  );
}
