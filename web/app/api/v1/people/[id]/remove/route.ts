import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { removePerson } from '@/lib/service';

// POST: remove a person from NicoDesk, with a reason (admins see it) and one person to take over what they hold.
// Admins only; nothing they did is deleted, and Bring back (PATCH active: true) undoes it. route() refuses it under View as.
export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, z.object({ handTo: z.string().min(1).max(80).nullable().optional(), reason: z.string().max(200) }).strict());
  return removePerson(db, me.person.id, me.team.id, params.id, b.handTo ?? null, b.reason);
});
