import { requireMe } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { listAsks, listNotices, myTasks, teamTasks } from '@/lib/service';
import { addDays, istDate, mondayOf, today } from '@/lib/time';
import { teamProjects } from '@/lib/plan';
import { HomeView } from '@/components/HomeView';

export const dynamic = 'force-dynamic';

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default async function Home() {
  const me = await requireMe();
  const { d, names, projectNames, activeOpts, isLead } = await lookups(me);
  const t = today();
  const [mine, notices, all, projects, asks] = await Promise.all([
    myTasks(d, me.person.id, me.team.id), listNotices(d, me.person.id, true), teamTasks(d, me.team.id), teamProjects(d, me.team.id),
    listAsks(d, me.team.id, me.person.id),
  ]);
  const weekStart = mondayOf(t);
  const doneThisWeek = all.filter((x) => x.ownerId === me.person.id && x.statusCategory === 'done' && x.closedAt && istDate(x.closedAt) >= weekStart);
  const assignedNotice = Object.fromEntries(notices.filter((n) => n.kind === 'assigned').map((n) => [n.taskId, n.id]));
  return (
    <HomeView
      greeting={`${greeting()}, ${me.person.displayName.split(' ')[0]}`}
      today={t}
      weekEnd={addDays(weekStart, 6)}
      meId={me.person.id}
      isLead={isLead}
      mine={[...mine.assigned, ...mine.tasks]}
      newIds={mine.assigned.map((x) => x.id)}
      assignedNotice={assignedNotice}
      waiting={mine.blockedOnMe}
      asks={asks}
      done={doneThisWeek}
      names={names}
      projectNames={projectNames}
      people={activeOpts}
      projects={projects.filter((p) => p.kind === 'tasks').map((p) => ({ id: p.id, name: p.name }))}
      workstreamsByProject={Object.fromEntries(projects.map((p) => [p.id, p.workstreams]))}
    />
  );
}
