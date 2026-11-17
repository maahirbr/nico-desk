import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { createNote, listNotes } from '@/lib/notes';

// My notes (15 Nov; Apple Notes style 16 Nov). GET: the list, newest first. POST: a new, empty note ({name} keeps a name;
// without one it is untitled and takes its first line).
export const GET = route(async ({ me, db }) => listNotes(db, me));
export const POST = route(async ({ req, me, db }) => {
  const b = req.headers.get('content-type')?.includes('json') ? await readBody(req, z.object({ name: z.string().max(120).optional() }).strict()) : {};
  return createNote(db, me, b.name);
});
