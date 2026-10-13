import { notFound } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { ApiError } from '@/lib/errors';
import { lookups } from '@/lib/page';
import { teamProjects } from '@/lib/plan';
import { personView } from '@/lib/service';
import { fmtStamp, today } from '@/lib/time';
import { groupLog } from '@/components/logText';
import { PersonPage } from '@/components/PersonPage';

export const dynamic = 'force-dynamic';

// A teammate's page. It shows only what any teammate can already read: team tasks, their logs and project
// membership. The on-time record shows only to a lead, an admin or the person themselves (the ledger's rule).
export default async function PersonRoute({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  const { id } = await params;
  const { d, names, projectNames, activeOpts, isLead } = await lookups(me);
  let v;
  try {
    v = await personView(d, me.team.id, me.person.id, id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const projects = await teamProjects(d, me.team.id);
  return (
    <PersonPage
      personId={v.person.id} email={v.person.email} phone={v.phone} teamName={v.teamName} appRoles={v.person.appRoles} hasPhoto={v.hasPhoto} name={v.person.displayName} role={v.person.role} department={v.person.department} active={v.person.active}
      meId={me.person.id} isLead={isLead} today={today()} names={names} projectNames={projectNames} people={activeOpts}
      workstreamsByProject={Object.fromEntries(projects.map((p) => [p.id, p.workstreams]))}
      projects={v.projects} open={v.open} waitingOnThem={v.waitingOnThem} waitingOnOthers={v.waitingOnOthers} record={v.record}
      recent={groupLog(v.recent, names, projectNames).slice(0, 12).map((e) => ({
        id: e.key, at: fmtStamp(e.at), whoId: e.actor_id, who: e.actorName ?? (e.origin === 'sheet' ? 'Sheet reader' : 'System'),
        text: e.text, taskId: e.entity_id, task: e.taskTitle,
      }))}
    />
  );
}
