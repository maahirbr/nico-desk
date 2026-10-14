import { z } from 'zod';
import { bad } from '@/lib/errors';
import { readBody, route, sameTeam, zVersion } from '@/lib/http';
import { editTask, getTask } from '@/lib/service';

type P = { id: string };

export const GET = route<P>(async ({ params, me, db }) => {
  const t = await getTask(db, params.id);
  sameTeam(me, t.teamId);
  return t;
});

const Body = z.object({
  version: zVersion,
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().max(600).nullable().optional(),
  note: z.string().max(140).nullable().optional(),
  projectId: z.string().nullable().optional(),
  workstream: z.string().trim().max(60).nullable().optional(),
  ownerId: z.string().optional(),
}).strict();

export const PATCH = route<P>(async ({ req, params, me, db }) => {
  const raw = await req.clone().json().catch(() => ({}));
  if (raw && typeof raw === 'object' && ('dueOn' in raw || 'firstDueOn' in raw))
    throw bad('due_on_locked', 'Dates change only through renegotiate, with a reason.', 'dueOn');
  const b = await readBody(req, Body);
  sameTeam(me, (await getTask(db, params.id)).teamId);
  return editTask(db, me.person.id, params.id, b);
});
