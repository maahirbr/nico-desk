import { z } from 'zod';
import { addComment, COMMENT_MAX, listComments } from '@/lib/comments';
import { readBody, route } from '@/lib/http';

// GET: the thread, for whoever can see the project (hidden reads as 404). POST: add a comment.
export const GET = route<{ id: string }>(({ params, me, db }) => listComments(db, me, 'project', params.id));

export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const { body } = await readBody(req, z.object({ body: z.string().max(COMMENT_MAX + 200) }).strict());
  return addComment(db, me, 'project', params.id, body);
});
