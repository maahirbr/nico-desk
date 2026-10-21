import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { myProfile, setNames, setPhone } from '@/lib/service';

// Your own name, nickname and phone number. Send any of them. An empty nickname or phone clears it.
const Body = z.object({ name: z.string().max(80).optional(), nickname: z.string().max(40).optional(), phone: z.string().max(40).optional() }).strict();

export const PATCH = route(async ({ req, me, db }) => {
  const { name, nickname, phone } = await readBody(req, Body);
  await setNames(db, me.person.id, { name, nickname });
  if (phone !== undefined) await setPhone(db, me.person.id, phone);
  return myProfile(db, me.person.id);
});
