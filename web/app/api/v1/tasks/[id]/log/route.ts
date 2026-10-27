import { route } from '@/lib/http';
import { taskLog } from '@/lib/service';
import { taskFor } from '@/lib/visibility';

export const GET = route<{ id: string }>(async ({ req, params, me, db }) => {
  await taskFor(db, me, params.id);
  const q = new URL(req.url).searchParams;
  return taskLog(db, params.id, q.get('before') ?? undefined, Number(q.get('limit') ?? 50) || 50);
});
