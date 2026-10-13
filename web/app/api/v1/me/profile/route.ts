import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { setPhone } from '@/lib/service';

// Your own phone number. An empty string clears it.
const Body = z.object({ phone: z.string().max(40) }).strict();

export const PATCH = route(async ({ req, me, db }) => {
  const { phone } = await readBody(req, Body);
  return { phone: await setPhone(db, me.person.id, phone) };
});
