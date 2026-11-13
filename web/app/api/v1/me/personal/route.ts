import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { updatePersonal } from '@/lib/service';

// PATCH: my Personal page's settings (13 Nov): its description and accent colour. route() refuses it under View as.
export const PATCH = route(async ({ req, me, db }) => {
  const b = await readBody(req, z.object({ description: z.string().max(220).nullable().optional(), accent: z.enum(['orange', 'sage', 'indigo']).nullable().optional(), notesFirst: z.boolean().optional() }).strict());
  return updatePersonal(db, me.person.id, me.team.id, b);
});
