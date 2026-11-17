import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { getNote, saveNote } from '@/lib/notes';

// My notes in Personal (11 Nov; several named notes since 15 Nov). GET ?id=: one note, the first without an id.
// PUT: save a note (the editor sends it a moment after each pause); without an id, the first note.
export const GET = route(async ({ req, me, db }) => getNote(db, me, new URL(req.url).searchParams.get('id')));
export const PUT = route(async ({ req, me, db }) => {
  const b = await readBody(req, z.object({ doc: z.unknown(), id: z.string().min(1).max(80).optional() }).strict());
  return saveNote(db, me, b.id, b.doc);
});
