import { z } from 'zod';
import { setFocus } from '@/lib/focus';
import { readBody, route } from '@/lib/http';

// PUT: today's picks on my Personal page (16 Nov), the whole list at once, up to 3 task ids. route() refuses it under View as.
export const PUT = route(async ({ req, me, db }) => {
  const b = await readBody(req, z.object({ ids: z.array(z.string().min(1).max(64)).max(3) }).strict());
  return setFocus(db, me, b.ids);
});
