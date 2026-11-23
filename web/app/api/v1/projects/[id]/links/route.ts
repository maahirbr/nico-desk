import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { addProjectLink } from '@/lib/projectLinks';

// POST: add a key document to a project (23 Nov). The owner, its lead or an admin; View as refuses it (route()).
const Body = z.object({ url: z.string().max(2000), label: z.string().max(80).nullable().optional(), nicobarOnly: z.boolean().optional() }).strict();

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => ({ links: await addProjectLink(db, me, params.id, await readBody(req, Body)) }));
