import { z } from 'zod';
import { rateLimit, readBody, route } from '@/lib/http';
import { MAX_SENTENCE, readSentence } from '@/lib/sentenceRead';

// Reads what a person typed or said ("ask Sam to send me the files by Monday") into one or more new tasks. Writes nothing and
// stores nothing. A POST, so View as is refused by route() like every other write, and rate limited since it may call a model.
const Body = z.object({ text: z.string().min(1, 'Type what needs doing first.').max(MAX_SENTENCE, 'That is a lot at once. Add up to ten tasks at a time.') }).strict();

export const POST = route(async ({ req, me, db }) => {
  const b = await readBody(req, Body);
  rateLimit(`sentence:${me.realPerson.id}`, 30);
  return readSentence(db, me, b.text);
});
