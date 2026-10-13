import { z } from 'zod';
import { rateLimit, readBody, route } from '@/lib/http';
import { MAX_SENTENCE, readSentence } from '@/lib/sentenceRead';

// Reads one sentence ("ask Sam to send me the files by Monday") into the fields of a new task. Writes nothing and
// stores nothing. A POST, so View as is refused by route() like every other write, and rate limited since it may call a model.
const Body = z.object({ text: z.string().min(1, 'Type what needs doing first.').max(MAX_SENTENCE, 'Keep it to a sentence or two.') }).strict();

export const POST = route(async ({ req, me, db }) => {
  const b = await readBody(req, Body);
  rateLimit(`sentence:${me.realPerson.id}`, 30);
  return readSentence(db, me, b.text);
});
