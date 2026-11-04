import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { settleHandover } from '@/lib/service';

// POST: keep a handed-over item ({}), or pass it on ({ to }). Only the person it was handed to.
export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, z.object({ to: z.string().min(1).max(80).nullable().optional() }).strict());
  return settleHandover(db, me.person.id, me.team.id, params.id, b.to ?? null);
});
