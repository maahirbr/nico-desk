import { ApiError } from '@/lib/errors';
import { route } from '@/lib/http';
import { deletePhoto, PHOTO_MAX_BYTES, savePhoto } from '@/lib/service';

// The browser has already cropped the photo square and shrunk it to 256px. The body is the image bytes; the
// Content-Type says which kind. The service checks size and the first bytes. route() refuses View as and cross-site calls.
export const PUT = route(async ({ req, me, db }) => {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > PHOTO_MAX_BYTES) throw new ApiError(413, 'photo_too_big', 'The photo must be under 200 KB.', 'photo');
  const mime = (req.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  const bytes = new Uint8Array(await req.arrayBuffer());
  await savePhoto(db, me.person.id, bytes, mime);
  return { ok: true };
});

export const DELETE = route(async ({ me, db }) => {
  await deletePhoto(db, me.person.id);
  return { ok: true };
});
