import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { lookups } from '@/lib/page';
import { getProject, pendingProposals, planState, projectMembers, type Project } from '@/lib/plan';
import { projectLog, projectTasks } from '@/lib/service';
import { fmtStamp, today } from '@/lib/time';
import { logLine } from '@/components/logText';
import { PlanBoard } from '@/components/PlanBoard';
import { ProjectHeader } from '@/components/ProjectHeader';
import { TaskBoard } from '@/components/TaskBoard';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  const { d, names, people, projectNames, isLead, isAdmin } = await lookups(me);
  let p: Project;
  try {
    p = await getProject(d, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  if (p.teamId !== me.team.id) notFound();
  const active = people.filter((x) => x.active).map((x) => ({ id: x.id, name: x.displayName, role: x.role, department: x.department }));
  const opts = active.map((x) => ({ id: x.id, name: x.name }));
  const members = await projectMembers(d, p.id);

  return (
    <>
      <Link className="crumb" href="/projects">← All projects</Link>
      <ProjectHeader project={p} members={members} names={names} people={opts} meId={me.person.id}
        canEdit={p.ownerId === me.person.id || isLead || isAdmin} today={today()} />
      {p.kind === 'plan' ? (
        <PlanBoard project={p} state={await planState(d, p.id)} people={active} names={names} meId={me.person.id} today={today()} />
      ) : (
        <TaskBoard
          projectId={p.id}
          tasks={await projectTasks(d, p.id)}
          people={active}
          names={names}
          projectNames={projectNames}
          meId={me.person.id}
          isLead={isLead}
          today={today()}
          workstreams={p.workstreams}
          proposals={await pendingProposals(d, p.id)}
          log={(await projectLog(d, p.id)).map((e) => ({
            id: e.id, at: fmtStamp(e.at), who: e.actorName ?? (e.origin === 'sheet' ? 'Sheet reader' : 'System'),
            text: `${logLine(e, names, { [p.id]: p.name })}`, task: e.taskTitle, taskId: e.entity_id, reason: e.reason,
          }))}
        />
      )}
    </>
  );
}
