import { ApiError } from '@/lib/errors';
import { route } from '@/lib/http';
import { deletePhoto, PHOTO_MAX_BYTES, savePhoto } from '@/lib/service';

// The browser has already cropped the photo square and shrunk it to 256px. The body is the image bytes; the
// Content-Type says which kind. The service checks size and the first bytes. route() refuses View as and cross-site calls.
export const PUT = route(async ({ req, me, db }) => {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > PHOTO_MAX_BYTES) throw new ApiError(413, 'photo_too_big', 'The photo must be under 200 KB.', 'photo');
  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const bytes = await readCapped(req, PHOTO_MAX_BYTES);
  await savePhoto(db, me.person.id, bytes, mime);
  return { ok: true };
});

// content-length can be absent (chunked) or wrong, so the body is read in chunks and refused as soon as it passes
// the cap, instead of buffering an unbounded upload.
async function readCapped(req: Request, max: number): Promise<Uint8Array> {
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array(0);
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel();
      throw new ApiError(413, 'photo_too_big', 'The photo must be under 200 KB.', 'photo');
    }
    parts.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) { out.set(p, at); at += p.length; }
  return out;
}

export const DELETE = route(async ({ me, db }) => {
  await deletePhoto(db, me.person.id);
  return { ok: true };
});
