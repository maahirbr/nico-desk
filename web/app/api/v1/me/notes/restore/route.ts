import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { restoreNote } from '@/lib/notes';

// POST: bring back a note as it stood the day before (and press again to undo that). {id} picks the note; none, the first.
export const POST = route(async ({ req, me, db }) => {
  const b = req.headers.get('content-type')?.includes('json') ? await readBody(req, z.object({ id: z.string().min(1).max(80).optional() }).strict()) : {};
  return restoreNote(db, me, b.id);
});
