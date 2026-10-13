import { redirect } from 'next/navigation';
import { requireMe } from '@/lib/auth';
import { lookups } from '@/lib/page';
import { seenProjects } from '@/lib/visibility';
import { messageForTask } from '@/lib/teamchat';
import { today } from '@/lib/time';
import { NewTaskPage } from '@/components/NewTaskPage';

export const dynamic = 'force-dynamic';

// "Make a task" in chat opens this page with ?fromMessage=<id>. The id goes in the address, not the message text.
// The page reads the message for this person: a hidden or removed one is ignored and the form opens empty.
export default async function NewTask({ searchParams }: { searchParams: Promise<{ fromMessage?: string }> }) {
  const me = await requireMe();
  if (me.viewingAs) redirect('/me'); // read-only view: nothing to create
  const { fromMessage } = await searchParams;
  const { d, sight, activeOpts } = await lookups(me);
  const projects = (await seenProjects(d, me, sight)).filter((p) => p.kind === 'tasks' && !p.archivedAt);
  const from = fromMessage ? await messageForTask(d, me, fromMessage).catch(() => null) : null;
  const words = (from?.text ?? '').split('\n')[0].replace(/\s+/g, ' ').trim();
  const title = words.length > 200 ? `${words.slice(0, 197).trimEnd()}...` : words;
  return (
    <NewTaskPage people={activeOpts} meId={me.person.id} today={today()}
      projects={projects.map((p) => ({ id: p.id, name: p.name }))}
      wsByProject={Object.fromEntries(projects.map((p) => [p.id, p.workstreams]))}
      from={from ? {
        id: from.id, roomName: from.roomName, back: `/chat?room=${encodeURIComponent(from.roomId)}`, text: from.text.length > 400 ? `${from.text.slice(0, 397)}...` : from.text,
        title: title.length >= 3 ? title : '', projectId: from.roomKind === 'project' && projects.some((p) => p.id === from.roomId) ? from.roomId : undefined,
      } : undefined} />
  );
}
