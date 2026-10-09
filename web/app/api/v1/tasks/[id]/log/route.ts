import { route, sameTeam } from '@/lib/http';
import { getTask, taskLog } from '@/lib/service';

export const GET = route<{ id: string }>(async ({ req, params, me, db }) => {
  sameTeam(me, (await getTask(db, params.id)).teamId);
  const q = new URL(req.url).searchParams;
  return taskLog(db, params.id, q.get('before') ?? undefined, Number(q.get('limit') ?? 50) || 50);
});
