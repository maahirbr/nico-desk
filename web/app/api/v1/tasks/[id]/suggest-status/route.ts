import { z } from 'zod';
import { jevOn } from '@/lib/jev';
import { suggestStatus } from '@/lib/jevStatus';
import { rateLimit, readBody, route } from '@/lib/http';
import { taskFor } from '@/lib/visibility';

// Asks Jev what status a note implies. It reads and answers; it never writes. It goes through route(), so View as
// refuses it with the other POSTs. The person applies a suggestion with the normal status calls.
// Off, slow or unsure: { suggestion: null } and nothing else changes.
export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const { text } = await readBody(req, z.object({ text: z.string().max(280) }).strict());
  const t = await taskFor(db, me, params.id);
  if (!jevOn()) return { suggestion: null };
  try { rateLimit(`jev-s:${me.realPerson.id}`, 20); } catch { return { suggestion: null }; }
  return { suggestion: await suggestStatus(db, me.team.id, t, text) };
});
