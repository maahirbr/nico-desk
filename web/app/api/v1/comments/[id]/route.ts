import { z } from 'zod';
import { COMMENT_MAX, deleteComment, editComment } from '@/lib/comments';
import { readBody, route } from '@/lib/http';

// PATCH: change a comment. DELETE: remove it (the thread then reads "Comment removed"). Only the author, for both.
export const PATCH = route<{ id: string }>(async ({ req, params, me, db }) => {
  const { body } = await readBody(req, z.object({ body: z.string().max(COMMENT_MAX + 200) }).strict());
  return editComment(db, me, params.id, body);
});

export const DELETE = route<{ id: string }>(async ({ params, me, db }) => {
  await deleteComment(db, me, params.id);
  return new Response(null, { status: 204 });
});
