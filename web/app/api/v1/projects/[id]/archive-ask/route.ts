import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { askToArchive, declineArchiveAsk } from '@/lib/plan';
import { projectFor } from '@/lib/visibility';

// A member asks the owner and lead to archive a project (POST, with a reason); the owner, lead or an admin says Not now
// (DELETE). Archiving it answers the ask too. In the app only. Refused under View as, like every write.
const Body = z.object({ reason: z.string().min(1).max(280) }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  await projectFor(db, me, params.id);
  return askToArchive(db, me.person.id, params.id, b.reason);
});

export const DELETE = route<{ id: string }>(async ({ params, me, db }) => {
  await projectFor(db, me, params.id);
  await declineArchiveAsk(db, me.person.id, params.id);
  return new Response(null, { status: 204 });
});
