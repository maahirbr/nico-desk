import { z } from 'zod';
import { bad } from '@/lib/errors';
import { readBody, route, zVersion } from '@/lib/http';
import { editTask } from '@/lib/service';
import { assertSeesProject, taskFor } from '@/lib/visibility';

type P = { id: string };

export const GET = route<P>(async ({ params, me, db }) => {
  const t = await taskFor(db, me, params.id);
  // The owner or lead of its project may drop and reopen it (15 Nov), so the panel offers those.
  const head = !!t.projectId && (await db.query(`SELECT 1 FROM projects WHERE id = $1 AND (owner_id = $2 OR lead_id = $2)`, [t.projectId, me.person.id])).rows.length > 0;
  return { ...t, projectHead: head };
});

const Body = z.object({
  version: zVersion,
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().max(600).nullable().optional(),
  note: z.string().max(140).nullable().optional(),
  ownerRole: z.string().max(60).optional(),
  projectId: z.string().nullable().optional(),
  workstream: z.string().trim().max(60).nullable().optional(),
  partnerOwner: z.string().trim().max(60).nullable().optional(),
  ownerId: z.string().nullable().optional(),
}).strict();

export const PATCH = route<P>(async ({ req, params, me, db }) => {
  const raw = await req.clone().json().catch(() => ({}));
  if (raw && typeof raw === 'object' && ('dueOn' in raw || 'firstDueOn' in raw))
    throw bad('due_on_locked', 'Dates change only through renegotiate, with a reason.', 'dueOn');
  const b = await readBody(req, Body);
  await taskFor(db, me, params.id);
  await assertSeesProject(db, me, b.projectId);
  return editTask(db, me.person.id, params.id, b);
});
