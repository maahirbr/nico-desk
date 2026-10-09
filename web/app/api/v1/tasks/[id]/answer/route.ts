import { z } from 'zod';
import { readBody, route, sameTeam, zDate, zVersion } from '@/lib/http';
import { answerAsk, getTask } from '@/lib/service';

// The asked person answers: yes, a counter date, or can't with a reason.
const Body = z.discriminatedUnion('answer', [
  z.object({ version: zVersion, answer: z.literal('yes') }).strict(),
  z.object({ version: zVersion, answer: z.literal('counter'), counterOn: zDate, reason: z.string().max(280).optional() }).strict(),
  z.object({ version: zVersion, answer: z.literal('cant'), reason: z.string() }).strict(),
]);

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, Body);
  sameTeam(me, (await getTask(db, params.id)).teamId);
  return answerAsk(db, me.person.id, params.id, b);
});
