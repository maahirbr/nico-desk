import { z } from 'zod';
import { readBody, route, sameTeam, zDate } from '@/lib/http';
import { createTask } from '@/lib/service';
import { linkTaskToMessage, messageForTask } from '@/lib/teamchat';
import { assertSeesProject } from '@/lib/visibility';

const Body = z.object({
  teamId: z.string().optional(),
  title: z.string().trim().min(3).max(200),
  ownerId: z.string(),
  dueOn: zDate,
  projectId: z.string().nullable().optional(),
  workstream: z.string().trim().max(60).nullable().optional(),
  description: z.string().max(600).nullable().optional(),
  note: z.string().max(140).nullable().optional(),
  ownerRole: z.string().max(60).optional(),
  fromMessage: z.string().max(80).optional(), // a chat message this task is made from; the task links back to it
}).strict();

export const POST = route(async ({ req, me, db }) => {
  const b = await readBody(req, Body);
  const teamId = b.teamId ?? me.team.id;
  sameTeam(me, teamId);
  await assertSeesProject(db, me, b.projectId);
  const { fromMessage, ...input } = b;
  // The message is checked first, so a hidden or removed one never leaves a task without its link.
  if (fromMessage) await messageForTask(db, me, fromMessage);
  const task = await createTask(db, me.person.id, { ...input, teamId });
  if (fromMessage) await linkTaskToMessage(db, me, fromMessage, task.id);
  return Response.json(task, { status: 201 });
});
