import { requireMe } from '@/lib/auth';
import { latestEndedFirst } from '@/lib/derive';
import { homeUpdates, lookups } from '@/lib/page';
import { listNotices, myTasks } from '@/lib/service';
import { seenProjects, seenTasks } from '@/lib/visibility';
import { addDays, istDate, mondayOf, today } from '@/lib/time';
import { myProjects } from '@/lib/plan';
import { glanceOf } from '@/lib/glance';
import { HomeView } from '@/components/HomeView';

export const dynamic = 'force-dynamic';

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default async function Home() {
  const me = await requireMe();
  const { d, sight, names, projectNames, activeOpts, isLead } = await lookups(me);
  const t = today();
  const updates = await homeUpdates(me, d, names, projectNames);
  const [mine, notices, all, projects, onProjects] = await Promise.all([
    myTasks(d, me.person.id, me.team.id), listNotices(d, me.person.id, true), seenTasks(d, me, undefined, sight), seenProjects(d, me, sight),
    myProjects(d, me.team.id, me.person.id),
  ]);
  const weekStart = mondayOf(t);
  const doneThisWeek = all.filter((x) => x.ownerId === me.person.id && x.statusCategory === 'done' && x.closedAt && istDate(x.closedAt) >= weekStart).sort(latestEndedFirst);
  // Dropped tasks fold away under Home's own collapsed list. A drop sets no closed_at, so all of them show there.
  const dropped = all.filter((x) => x.ownerId === me.person.id && x.statusCategory === 'dropped').sort(latestEndedFirst);
  const assignedNotice = Object.fromEntries(notices.filter((n) => n.kind === 'assigned').map((n) => [n.taskId, n.id]));
  // Tasks that were mine and went to someone else (an in-app notice, nothing is sent outside the app).
  const ownerNow = new Map(all.map((x) => [x.id, x.ownerId]));
  const movedAway = notices.filter((n) => n.kind === 'reassigned_away').map((n) => ({
    noticeId: n.id, taskId: n.taskId, title: n.taskTitle, toName: names[ownerNow.get(n.taskId) ?? ''] ?? null,
  }));
  const glance = glanceOf(all, {
    personId: me.person.id, today: t, projects: onProjects, projectNames, people: activeOpts, showTeam: isLead,
  });
  return (
    <HomeView
      greeting={`${greeting()}, ${me.person.displayName.split(' ')[0]}`}
      today={t}
      weekEnd={addDays(weekStart, 6)}
      meId={me.person.id}
      updates={updates}
      isLead={isLead}
      mine={[...mine.assigned, ...mine.tasks]}
      newIds={mine.assigned.map((x) => x.id)}
      assignedNotice={assignedNotice}
      noticeIds={notices.map((n) => n.id)}
      movedAway={movedAway}
      waiting={mine.blockedOnMe}
      done={doneThisWeek}
      dropped={dropped}
      names={names}
      projectNames={projectNames}
      people={activeOpts}
      projects={projects.filter((p) => p.kind === 'tasks' && !p.archivedAt).map((p) => ({ id: p.id, name: p.name }))}
      workstreamsByProject={Object.fromEntries(projects.map((p) => [p.id, p.workstreams]))}
      myProjects={onProjects}
      glance={glance}
    />
  );
}
