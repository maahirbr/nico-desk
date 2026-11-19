import { route } from '@/lib/http';
import { deleteFeedback } from '@/lib/feedback';

// DELETE: the writer or an admin deletes a note (hidden, kept). View as refuses it in route().
export const DELETE = route<{ id: string }>(async ({ params, me, db }) => deleteFeedback(db, me, params.id));
