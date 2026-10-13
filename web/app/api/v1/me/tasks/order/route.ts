import { jevOn } from '@/lib/jev';
import { suggestedOrder } from '@/lib/jevUses';
import { rateLimit, route } from '@/lib/http';
import { myTasks } from '@/lib/service';

// A suggested order for the caller's own open tasks, as a sort option on Home. It reads and answers; it never writes
// and never changes the default order, which Home keeps. It goes through route(), so View as refuses it.
// Off, slow or unsure: { ok: false } and Home keeps the default order and says so.
export const POST = route(async ({ me, db }) => {
  if (!jevOn()) return { ok: false, reason: 'off' };
  try { rateLimit(`jev-o:${me.realPerson.id}`, 10); } catch { return { ok: false, reason: 'unavailable' }; }
  const mine = await myTasks(db, me.person.id, me.team.id);
  const r = await suggestedOrder(db, me.team.id, [...mine.assigned, ...mine.tasks]);
  return r.ok ? { ok: true, ids: r.ids, why: r.why } : { ok: false, reason: r.reason };
});
