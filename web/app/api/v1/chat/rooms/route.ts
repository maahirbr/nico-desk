import { route } from '@/lib/http';
import { listRooms } from '@/lib/teamchat';

// The rooms this person can enter, the team room first, with unread counts. Hidden project rooms are not listed.
export const GET = route(async ({ me, db }) => {
  const rooms = await listRooms(db, me);
  return { rooms, unread: rooms.reduce((n, r) => n + r.unread, 0) };
});
