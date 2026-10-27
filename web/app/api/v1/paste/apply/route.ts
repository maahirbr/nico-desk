import { z } from 'zod';
import { readBody, route, zDate, zVersion } from '@/lib/http';
import { applyProposal, STATUS_WORDS } from '@/lib/paste';

// Applies one approved proposal through the normal service rules, so the log, the rights and Undo work as everywhere else.
// Nothing is written without this call, and one call makes one change.
const Body = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('new'), title: z.string().trim().min(3).max(200), ownerId: z.string(), dueOn: zDate, projectId: z.string().nullable() }).strict(),
  z.object({ kind: z.literal('update'), taskId: z.string(), version: zVersion, status: z.enum(STATUS_WORDS).optional(), dueOn: zDate.optional(), reason: z.string().max(280).optional() }).strict(),
  z.object({ kind: z.literal('note'), taskId: z.string(), text: z.string().trim().min(1).max(280) }).strict(),
]);

export const POST = route(async ({ req, me, db }) => {
  const b = await readBody(req, Body);
  return applyProposal(db, me, b);
});
