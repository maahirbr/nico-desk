import { route } from '@/lib/http';
import { threadsFor } from '@/lib/threads';

// "Connects to" for the task drawer. The lines are already filtered by what the reader may see.
export const GET = route<{ id: string }>(async ({ params, me, db }) => threadsFor(db, me, 'task', params.id));
