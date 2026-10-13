import { z } from 'zod';
import { rateLimit, readBody, route } from '@/lib/http';
import { MAX_CHARS, readChat } from '@/lib/paste';

// Reads a pasted chat and returns proposals. Writes nothing and stores nothing: the text lives in this request only.
// It is a POST, so View as is refused by route() like every other write, and it is rate limited since it calls a model.
const Body = z.object({ text: z.string().min(1, 'Paste a chat first.').max(MAX_CHARS, 'That chat is too long. Paste the last part of it.') }).strict();

export const POST = route(async ({ req, me, db }) => {
  const b = await readBody(req, Body);
  rateLimit(`paste:${me.realPerson.id}`, 8);
  return readChat(db, me, b.text);
});
