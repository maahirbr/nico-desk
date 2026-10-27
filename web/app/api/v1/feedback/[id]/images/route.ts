import { ApiError } from '@/lib/errors';
import { addFeedbackImage, FEEDBACK_IMAGE_MAX } from '@/lib/feedback';
import { route } from '@/lib/http';

// POST: one screenshot on your own note. The body is the image bytes, already shrunk in the browser; Content-Type says
// which kind. The service checks the writer, the size, the first bytes and the limit of three. route() refuses View as.
export const POST = route<{ id: string }>(async ({ req, params, me, db }) => {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > FEEDBACK_IMAGE_MAX) throw new ApiError(413, 'image_too_big', 'A picture must be under 600 KB.', 'image');
  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  return addFeedbackImage(db, me, params.id, await readCapped(req, FEEDBACK_IMAGE_MAX), mime);
});

// content-length can be missing or wrong, so the body is read in chunks and refused once it passes the cap.
async function readCapped(req: Request, max: number): Promise<Uint8Array> {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) { await reader.cancel(); throw new ApiError(413, 'image_too_big', 'A picture must be under 600 KB.', 'image'); }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}
