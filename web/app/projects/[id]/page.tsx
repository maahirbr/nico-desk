import { openArchiveAsk, projectAccess } from '@/lib/plan';
import { viewOnlyProjects } from '@/lib/sight';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { lookups } from '@/lib/page';
import { pendingProposals, planState, projectMembers, projectViewers, type Project } from '@/lib/plan';
import { lineSplit, taskSplit } from '@/lib/progress';
import { ReadOnlyProvider } from '@/components/readonly';
import { myTasks, projectLog, projectTasks } from '@/lib/service';
import { setupState } from '@/lib/setup';
import { projectFor } from '@/lib/visibility';
import { fmtStamp, istDate, today } from '@/lib/time';
import { groupLog } from '@/components/logText';
import { PlanBoard } from '@/components/PlanBoard';
import { ProjectHeader } from '@/components/ProjectHeader';
import { ProjectHealth } from '@/components/ProjectHealth';
import { SetupList } from '@/components/SetupList';
import { TaskBoard } from '@/components/TaskBoard';
import { NotesShelf } from '@/components/NotesShelf';
import { PersonalTasks } from '@/components/PersonalTasks';
import { PersonalHeader } from '@/components/PersonalHeader';
import { getNote, listNotes } from '@/lib/notes';
import { myFocus } from '@/lib/focus';
import { PersonalDrawerHost } from '@/components/PersonalDrawer';
import { PersonalToday } from '@/components/PersonalToday';

export const dynamic = 'force-dynamic';

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  const { d, names, people, projectNames, activeOpts, isLead, isAdmin, readOnly } = await lookups(me);
  let p: Project;
  try {
    p = await projectFor(d, me, id); // hidden or on another team reads as missing
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }
  if (p.teamId !== me.team.id) notFound();
  const active = people.filter((x) => x.active).map((x) => ({ id: x.id, name: x.displayName, role: x.role, department: x.department }));
  // My Personal project (11 Nov): only I reach this page (lib/sight.ts). One view: my tasks on top, my running notes below.
  if (p.personalFor) {
    // Today's 3 (16 Nov): my picks, and my open tasks from any project to pick from (lib/focus.ts). Several notes (15 Nov).
    const [tasks, notes, focus, mine] = await Promise.all([projectTasks(d, p.id), listNotes(d, me), myFocus(d, me), myTasks(d, me.person.id, me.team.id)]);
    const page = notes.length ? await getNote(d, me, notes[0].id) : null;
    return (
      <>
        <Link className="crumb" href="/projects">← All projects</Link>
        <ReadOnlyProvider readOnly={readOnly}>
        <PersonalDrawerHost personalIds={tasks.map((x) => x.id)} meId={me.person.id} meName={me.person.displayName} isLead={isLead}
          people={activeOpts} today={today()} projectNames={projectNames}>
        <div className={`personal-page accent-${p.accent ?? 'orange'}`}>
          <PersonalHeader description={p.intro} accent={p.accent} notesFirst={p.notesFirst} goalLabel={p.targetLabel} goalOn={p.launchOn} today={today()} />
          {focus && <PersonalToday picks={focus.picks} carry={focus.carry} options={[...mine.assigned, ...mine.tasks]} today={today()} meId={me.person.id}
            meName={me.person.displayName} personalId={p.id} projectNames={projectNames} />}
          {/* Tasks on top unless Settings says notes first (13 Nov). */}
          {(() => {
            const t = <PersonalTasks key="t" tasks={tasks} projectId={p.id} teamId={me.team.id} meId={me.person.id} meName={me.person.displayName} today={today()} />;
            const n = page ? <NotesShelf key="n" notes={notes} open={page} projectId={p.id} meId={me.person.id} teamId={me.team.id} today={today()} /> : null;
            return p.notesFirst ? <>{n}{t}</> : <>{t}{n}</>;
          })()}
        </div>
        </PersonalDrawerHost>
        </ReadOnlyProvider>
      </>
    );
  }
  const opts = active.map((x) => ({ id: x.id, name: x.name }));
  const [members, viewers] = await Promise.all([projectMembers(d, p.id), projectViewers(d, p.id)]);
  const now = today();
  // The lead's health line reads the same work the board shows: tasks on a task board, lines on a plan board.
  const plan = p.kind === 'plan' ? await planState(d, p.id) : null;
  const tasks = p.kind === 'plan' ? [] : await projectTasks(d, p.id);
  const setup = await setupState(d, me, p.id); // null unless this person owns or leads the project, or is a lead or admin
  const split = plan ? lineSplit(plan.lines, now) : taskSplit(tasks, now);
  // View-only (15 Nov): they see everything and can copy the link, but add nothing (lib/sight.ts viewOnlyProjects).
  const viewOnly = (await viewOnlyProjects(d, me.team.id, me.person.id)).has(p.id);

  return (
    <>
      <Link className="crumb" href="/projects">← All projects</Link>
      <ProjectHeader project={p} members={members} viewers={viewers} names={names} people={opts} meId={me.person.id} isAdmin={!readOnly && isAdmin}
        access={readOnly ? 'view' : await projectAccess(d, p, me.person.id)} today={now} archiveAsk={await openArchiveAsk(d, p.id)} />
      {viewOnly && !p.archivedAt && <p className="small dim view-only-note">You can view this project. To add to it, ask its owner or lead to add you.</p>}
      {/* An archived project is read-only: the board hides its write controls, as it does in View as, and for view-only people. */}
      <ReadOnlyProvider readOnly={readOnly || !!p.archivedAt || viewOnly}>
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
          isHead={p.ownerId === me.person.id || p.leadId === me.person.id}
          today={now}
          workstreams={p.workstreams}
          partnerPeople={p.partnerName ? p.partnerPeople : []}
          partnerName={p.partnerName}
          proposals={await pendingProposals(d, p.id)}
          log={groupLog(await projectLog(d, p.id, 500), names, { [p.id]: p.name }).map((e) => ({
            id: e.key, at: fmtStamp(e.at), day: istDate(e.at), whoId: e.actor_id, who: e.actorName ?? (e.origin === 'sheet' ? 'Sheet reader' : 'System'),
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
