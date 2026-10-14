import { voteFeedback } from '@/lib/feedback';
import { route } from '@/lib/http';

// POST: "Me too" on a teammate's note. DELETE: take it back. Never on your own note; View as refuses both.
export const POST = route<{ id: string }>(({ params, me, db }) => voteFeedback(db, me, params.id, true));
export const DELETE = route<{ id: string }>(({ params, me, db }) => voteFeedback(db, me, params.id, false));
