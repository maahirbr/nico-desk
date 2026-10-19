import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { lookups } from '@/lib/page';
import { pendingProposals, planState, projectMembers, projectViewers, type Project } from '@/lib/plan';
import { lineSplit, taskSplit } from '@/lib/progress';
import { ReadOnlyProvider } from '@/components/readonly';
import { projectLog, projectTasks } from '@/lib/service';
import { setupState } from '@/lib/setup';
import { projectFor } from '@/lib/visibility';
import { fmtStamp, today } from '@/lib/time';
import { groupLog } from '@/components/logText';
import { PlanBoard } from '@/components/PlanBoard';
import { ProjectHeader } from '@/components/ProjectHeader';
import { ProjectHealth } from '@/components/ProjectHealth';
import { SetupList } from '@/components/SetupList';
import { TaskBoard } from '@/components/TaskBoard';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  const { d, names, people, projectNames, isLead, isAdmin, readOnly } = await lookups(me);
  let p: Project;
  try {
    p = await projectFor(d, me, id); // hidden or on another team reads as missing
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  if (p.teamId !== me.team.id) notFound();
  const active = people.filter((x) => x.active).map((x) => ({ id: x.id, name: x.displayName, role: x.role, department: x.department }));
  const opts = active.map((x) => ({ id: x.id, name: x.name }));
  const [members, viewers] = await Promise.all([projectMembers(d, p.id), projectViewers(d, p.id)]);
  const now = today();
  // The lead's health line reads the same work the board shows: tasks on a task board, lines on a plan board.
  const plan = p.kind === 'plan' ? await planState(d, p.id) : null;
  const tasks = p.kind === 'plan' ? [] : await projectTasks(d, p.id);
  const setup = await setupState(d, me, p.id); // null unless this person owns or leads the project, or is a lead or admin
  const split = plan ? lineSplit(plan.lines, now) : taskSplit(tasks, now);

  return (
    <>
      <Link className="crumb" href="/projects">← All projects</Link>
      <ProjectHeader project={p} members={members} viewers={viewers} names={names} people={opts} meId={me.person.id}
        canEdit={!readOnly && (p.ownerId === me.person.id || p.leadId === me.person.id || isLead || isAdmin)} today={now} />
      {/* An archived project is read-only: the board hides its write controls, as it does in View as. */}
      <ReadOnlyProvider readOnly={readOnly || !!p.archivedAt}>
      {setup && <SetupList projectId={p.id} steps={setup} />}
      {p.kind === 'plan' ? (
        <PlanBoard project={p} state={plan!} people={active} names={names} meId={me.person.id} today={now} />
      ) : (
        <TaskBoard
          projectId={p.id}
          tasks={tasks}
          people={active}
          names={names}
          projectNames={projectNames}
          meId={me.person.id}
          isLead={isLead}
          today={now}
          workstreams={p.workstreams}
          proposals={await pendingProposals(d, p.id)}
          log={groupLog(await projectLog(d, p.id, 60), names, { [p.id]: p.name }).map((e) => ({
            id: e.key, at: fmtStamp(e.at), whoId: e.actor_id, who: e.actorName ?? (e.origin === 'sheet' ? 'Sheet reader' : 'System'),
            text: e.text, task: e.taskTitle, taskId: e.entity_type === 'project' ? null : e.entity_id, reason: null,
          }))}
        />
      )}
      {/* The PM's layout: the header, the counts and the board at the top, then the update log and completed tasks.
          The meeting box, its agenda and comments are off project pages (the PM's call, 14 Oct). */}
      {/* A suggestion for the lead, drawn only while Jev is on. It is not stored and sets no status. */}
      {!p.archivedAt && (p.ownerId === me.person.id || p.leadId === me.person.id || isLead || isAdmin) && <ProjectHealth projectId={p.id} late={split.late} blocked={split.blocked} />}
      </ReadOnlyProvider>
    </>
  );
}
