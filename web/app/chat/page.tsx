import { requireMe } from '@/lib/auth';
import { lookups, one, type SP } from '@/lib/page';
import { listRooms } from '@/lib/teamchat';
import { ChatView } from '@/components/ChatView';

export const dynamic = 'force-dynamic';

// The rooms this person can see: the team room, then each project they can see. ?room=<id> opens one; an id they
// cannot see is ignored, so it shows the same as no id.
export default async function ChatPage({ searchParams }: { searchParams: SP }) {
  const me = await requireMe();
  const { d, activeOpts } = await lookups(me);
  const rooms = await listRooms(d, me);
  const asked = one((await searchParams).room);
  return <ChatView rooms={rooms} people={activeOpts} teamId={me.team.id} initialRoom={asked && rooms.some((r) => r.id === asked) ? asked : null} />;
}
