import { route } from '@/lib/http';
import { restorePage } from '@/lib/notes';

// POST: bring back the page as it stood the day before (and press again to undo that).
export const POST = route(async ({ me, db }) => restorePage(db, me));
