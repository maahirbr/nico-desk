import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { deleteNote, recoverNote, renameNote } from '@/lib/notes';

// One of my notes (15 Nov). PATCH {name}: rename it. DELETE: delete it (the only one leaves an empty "Notes").
export const PATCH = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, z.object({ name: z.string().max(120).optional(), recover: z.literal(true).optional() }).strict());
  if (b.recover) await recoverNote(db, me, params.id); // out of Recently Deleted (16 Nov)
  if (b.name !== undefined) await renameNote(db, me, params.id, b.name);
  return new Response(null, { status: 204 });
});
// DELETE: to Recently Deleted (30 days); a note already there, or ?forever=1, goes for good.
export const DELETE = route<{ id: string }>(async ({ req, params, me, db }) => {
  await deleteNote(db, me, params.id, new URL(req.url).searchParams.get('forever') === '1');
  return new Response(null, { status: 204 });
});
