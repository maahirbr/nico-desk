import { ApiError } from '@/lib/errors';
import { addReplyImage, FEEDBACK_IMAGE_MAX } from '@/lib/feedback';
import { route } from '@/lib/http';

// POST: one screenshot on your own reply (23 Nov). The body is the image bytes, shrunk in the browser. route() refuses View as.
export const POST = route<{ id: string; rid: string }>(async ({ req, params, me, db }) => {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > FEEDBACK_IMAGE_MAX) throw new ApiError(413, 'image_too_big', 'A picture must be under 600 KB.', 'image');
  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.length > FEEDBACK_IMAGE_MAX) throw new ApiError(413, 'image_too_big', 'A picture must be under 600 KB.', 'image');
  return addReplyImage(db, me, params.id, params.rid, bytes, mime);
});
