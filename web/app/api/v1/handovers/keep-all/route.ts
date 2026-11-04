import { route } from '@/lib/http';
import { handoversForMe, settleHandover } from '@/lib/service';

// POST: keep everything handed to me that is still open.
export const POST = route(async ({ me, db }) => {
  for (const h of await handoversForMe(db, me.person.id, me.team.id)) await settleHandover(db, me.person.id, me.team.id, h.id, null);
  return { ok: true };
});
