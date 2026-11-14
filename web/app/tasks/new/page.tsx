import { viewOnlyProjects } from '@/lib/sight';
import { redirect } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { seenProjects } from '@/lib/visibility';
import { today } from '@/lib/time';
import { NewTaskPage } from '@/components/NewTaskPage';

export const dynamic = 'force-dynamic';

export default async function NewTask() {
  const me = await requireMe();
  if (me.viewingAs) redirect('/me'); // read-only view: nothing to create
  const { d, sight, activeOpts } = await lookups(me);
  const viewOnly = await viewOnlyProjects(d, me.team.id, me.person.id); // only view these: no new tasks (15 Nov)
  const projects = (await seenProjects(d, me, sight)).filter((p) => p.kind === 'tasks' && !p.archivedAt && !viewOnly.has(p.id));
  return (
    <NewTaskPage people={activeOpts} meId={me.person.id} today={today()}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      wsByProject={Object.fromEntries(projects.map((p) => [p.id, p.workstreams]))} />
  );
}
