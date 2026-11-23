import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { reorderWorkstreams } from '@/lib/plan';

// POST: a task board's sub-projects in a new order (23 Nov), dragged in the side list. View as refuses it (route()).
const Body = z.object({ names: z.array(z.string().max(60)).max(20) }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => ({ names: await reorderWorkstreams(db, me.person.id, params.id, (await readBody(req, Body)).names) }));
