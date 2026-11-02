import { setFeedbackWorking } from '@/lib/feedback';
import { route } from '@/lib/http';

// POST: "I'm working on it" on an open note to fix. DELETE: let it go. No one is told. View as refuses both.
export const POST = route<{ id: string }>(({ params, me, db }) => setFeedbackWorking(db, me, params.id, true));
export const DELETE = route<{ id: string }>(({ params, me, db }) => setFeedbackWorking(db, me, params.id, false));
