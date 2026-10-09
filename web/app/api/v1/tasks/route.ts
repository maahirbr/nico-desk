import { z } from 'zod';
import { readBody, route, sameTeam, zDate } from '@/lib/http';
import { createTask } from '@/lib/service';

const Body = z.object({
  teamId: z.string().optional(),
  title: z.string().trim().min(3).max(200),
  ownerId: z.string(),
  dueOn: zDate,
  projectId: z.string().nullable().optional(),
  workstream: z.string().trim().max(60).nullable().optional(),
  description: z.string().max(600).nullable().optional(),
  note: z.string().max(140).nullable().optional(),
}).strict();

export const POST = route(async ({ req, me, db }) => {
  const b = await readBody(req, Body);
  const teamId = b.teamId ?? me.team.id;
  sameTeam(me, teamId);
  return Response.json(await createTask(db, me.person.id, { ...b, teamId }), { status: 201 });
});
