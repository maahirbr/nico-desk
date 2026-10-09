import { z } from 'zod';
import { readBody, route, sameTeam, zDate } from '@/lib/http';
import { createAsk } from '@/lib/service';

// v2: ask a teammate for a thing by a date. It waits for their answer before it is a task.
const Body = z.object({
  teamId: z.string().optional(),
  title: z.string().trim().min(3).max(200),
  toId: z.string(),
  dueOn: zDate,
  projectId: z.string().nullable().optional(),
  description: z.string().max(600).nullable().optional(),
}).strict();

export const POST = route(async ({ req, me, db }) => {
  const b = await readBody(req, Body);
  const teamId = b.teamId ?? me.team.id;
  sameTeam(me, teamId);
  return Response.json(await createAsk(db, me.person.id, { ...b, teamId }), { status: 201 });
});
