import { z } from 'zod';
import { readBody, route, zDate } from '@/lib/http';
import { updatePersonal } from '@/lib/service';

// PATCH: my Personal page's settings (13 Nov): its description, accent colour, which comes first, and (15 Nov) my goal date. route() refuses it under View as.
export const PATCH = route(async ({ req, me, db }) => {
  const b = await readBody(req, z.object({ description: z.string().max(220).nullable().optional(), accent: z.enum(['orange', 'sage', 'indigo']).nullable().optional(), notesFirst: z.boolean().optional(),
    goalLabel: z.string().max(60).nullable().optional(), goalOn: zDate.nullable().optional() }).strict());
  return updatePersonal(db, me.person.id, me.team.id, b);
});
