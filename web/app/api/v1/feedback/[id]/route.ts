import { markFeedbackRead } from '@/lib/feedback';
import { route } from '@/lib/http';

// PATCH: mark a note read. Admin only.
export const PATCH = route<{ id: string }>(({ params, me, db }) => markFeedbackRead(db, me, params.id));
