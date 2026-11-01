import { z } from 'zod';
import { readBody, route } from '@/lib/http';
import { setFeedbackKind } from '@/lib/feedback';

// POST: move a note between working well and to fix. View as refuses it in route().
export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const b = await readBody(req, z.object({ kind: z.enum(['fix', 'praise']) }).strict());
  return setFeedbackKind(db, me, params.id, b.kind);
});
