import { redirect } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { teamProjects } from '@/lib/plan';
import { today } from '@/lib/time';
import { NewTaskPage } from '@/components/NewTaskPage';

export const dynamic = 'force-dynamic';

export default async function NewTask() {
  const me = await requireMe();
  if (me.viewingAs) redirect('/me'); // read-only view: nothing to create
  const { d, activeOpts } = await lookups(me);
  const projects = (await teamProjects(d, me.team.id)).filter((p) => p.kind === 'tasks' && !p.archivedAt);
  return (
    <NewTaskPage people={activeOpts} meId={me.person.id} today={today()}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      wsByProject={Object.fromEntries(projects.map((p) => [p.id, p.workstreams]))} />
  );
}
