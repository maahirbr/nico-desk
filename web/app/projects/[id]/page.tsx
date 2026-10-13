import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { lookups } from '@/lib/page';
import { pendingProposals, planState, projectMembers, projectViewers, type Project } from '@/lib/plan';
import { dueDoneByWeek, lineDates, lineSplit, taskDates, taskSplit } from '@/lib/progress';
import { ReadOnlyProvider } from '@/components/readonly';
import { projectLog, projectTasks } from '@/lib/service';
import { meetingAgenda } from '@/lib/meetings';
import { projectFor } from '@/lib/visibility';
import { fmtStamp, today } from '@/lib/time';
import { groupLog } from '@/components/logText';
import { CommentThread } from '@/components/CommentThread';
import { ConnectsTo } from '@/components/ConnectsTo';
import { threadsFor } from '@/lib/threads';
import { PlanBoard } from '@/components/PlanBoard';
import { ProjectHeader } from '@/components/ProjectHeader';
import { ProjectHealth } from '@/components/ProjectHealth';
import { MeetingSection } from '@/components/MeetingSection';
import { DueDoneChart } from '@/components/ProjectVisuals';
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
  // The status bar and the weekly chart read the same work the board below shows: tasks on a task board, lines on a plan board.
  const plan = p.kind === 'plan' ? await planState(d, p.id) : null;
  const tasks = p.kind === 'plan' ? [] : await projectTasks(d, p.id);
  const split = plan ? lineSplit(plan.lines, now) : taskSplit(tasks, now);
  const weeks = dueDoneByWeek(plan ? lineDates(plan.lines) : taskDates(tasks), now);

  return (
    <>
      <Link className="crumb" href="/projects">← All projects</Link>
      <ProjectHeader project={p} members={members} viewers={viewers} names={names} people={opts} meId={me.person.id}
        canEdit={!readOnly && (p.ownerId === me.person.id || p.leadId === me.person.id || isLead || isAdmin)} today={now}
        split={split} />
      {/* A suggestion for the lead, drawn only while Jev is on. It is not stored and sets no status. */}
      {!p.archivedAt && (p.ownerId === me.person.id || p.leadId === me.person.id || isLead || isAdmin) && <ProjectHealth projectId={p.id} late={split.late} blocked={split.blocked} />}
      <div className="glance-grid glance-one"><DueDoneChart weeks={weeks} /></div>
      {/* An archived project is read-only: the board hides its write controls, as it does in View as. */}
      <ReadOnlyProvider readOnly={readOnly || !!p.archivedAt}>
      <MeetingSection projectId={p.id} kind={p.kind === 'plan' ? 'plan' : 'tasks'}
        rhythm={{ meetEvery: p.meetEvery, meetDay: p.meetDay, meetNext: p.meetNext, meetLast: p.meetLast }}
        agenda={await meetingAgenda(d, me, p.id, now)}
        canRun={p.ownerId === me.person.id || p.leadId === me.person.id || isLead || isAdmin} today={now} />
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
      <div className="card card-pad cn-card"><ConnectsTo lines={await threadsFor(d, me, 'project', p.id)} focus={`project:${p.id}`} /></div>
      <CommentThread subjectKind="project" subjectId={p.id} subjectTitle={p.name} people={opts} drawer={p.kind !== 'plan'} />
      </ReadOnlyProvider>
    </>
  );
}
