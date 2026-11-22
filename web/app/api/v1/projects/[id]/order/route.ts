import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { orderPersonal } from '@/lib/service';

// POST: the order of my own open Personal tasks (20 Nov). Only the Personal project's own person; View as refuses it.
const Body = z.object({ ids: z.array(z.string().min(1).max(80)).max(500) }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => orderPersonal(db, me.person.id, params.id, (await readBody(req, Body)).ids));
