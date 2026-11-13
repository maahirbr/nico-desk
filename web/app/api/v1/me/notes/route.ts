import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { myPage, savePage } from '@/lib/notes';

// My running notes page (11 Nov). GET: the page. PUT: save it (the editor sends it a moment after each pause).
export const GET = route(async ({ me, db }) => myPage(db, me));
export const PUT = route(async ({ req, me, db }) => savePage(db, me, (await readBody(req, z.object({ doc: z.unknown() }).strict())).doc));
